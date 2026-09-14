import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import type {
  WorkflowNodeInputDto,
  WorkflowEdgeInputDto,
} from './dto/create-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkflowDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          name: dto.name,
          type: dto.type,
          description: dto.description,
          config: dto.config ?? {},
          createdBy: userId,
        },
      });

      if (dto.nodes?.length) {
        await this.syncGraphStructure(tx, workflow.id, dto.nodes, dto.edges);
      }

      return workflow;
    });
  }

  findAll() {
    return this.prisma.workflow.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.workflow.findUniqueOrThrow({
      where: { id },
      include: {
        nodes: { orderBy: { positionY: 'asc' } },
        edges: true,
      },
    });
  }

  async update(id: string, dto: UpdateWorkflowDto) {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          description: dto.description,
          config: dto.config,
          isActive: dto.isActive,
        },
      });

      if (dto.nodes?.length) {
        await this.syncGraphStructure(tx, workflow.id, dto.nodes, dto.edges);
      }

      return workflow;
    });
  }

  remove(id: string) {
    return this.prisma.workflow.delete({ where: { id } });
  }

  private async syncGraphStructure(
    tx: Prisma.TransactionClient,
    workflowId: string,
    nodes: WorkflowNodeInputDto[],
    edges?: WorkflowEdgeInputDto[],
  ): Promise<void> {
    await tx.workflowEdge.deleteMany({ where: { workflowId } });
    await tx.workflowNode.deleteMany({ where: { workflowId } });

    // 为每个 node 分配正式 UUID id，并建立 clientId → uuid 映射
    const clientIdToUuid = new Map<string, string>();
    const nodeData = nodes.map((n) => {
      const id = uuidv4();
      clientIdToUuid.set(n.clientId, id);
      return {
        id,
        workflowId,
        type: n.type,
        label: n.label,
        positionX: n.positionX ?? 0,
        positionY: n.positionY ?? 0,
        config: n.config ?? {},
      };
    });

    await tx.workflowNode.createMany({ data: nodeData });

    if (edges?.length) {
      await tx.workflowEdge.createMany({
        data: edges
          .filter(
            (e) =>
              clientIdToUuid.has(e.sourceClientId) &&
              clientIdToUuid.has(e.targetClientId),
          )
          .map((e) => ({
            workflowId,
            sourceNodeId: clientIdToUuid.get(e.sourceClientId)!,
            targetNodeId: clientIdToUuid.get(e.targetClientId)!,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            label: e.label,
            condition: e.condition ?? undefined,
          })),
      });
    }
  }
}
