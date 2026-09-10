import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
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
    const workflow = await this.prisma.workflow.create({
      data: {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        config: dto.config ?? {},
        createdBy: userId,
      },
    });

    if (dto.nodes?.length) {
      await this.syncGraphStructure(workflow.id, dto.nodes, dto.edges);
    }

    return workflow;
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
    const workflow = await this.prisma.workflow.update({
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
      await this.syncGraphStructure(workflow.id, dto.nodes, dto.edges);
    }

    return workflow;
  }

  remove(id: string) {
    return this.prisma.workflow.delete({ where: { id } });
  }

  private async syncGraphStructure(
    workflowId: string,
    nodes: WorkflowNodeInputDto[],
    edges?: WorkflowEdgeInputDto[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.workflowEdge.deleteMany({ where: { workflowId } });
      await tx.workflowNode.deleteMany({ where: { workflowId } });

      await tx.workflowNode.createMany({
        data: nodes.map((n) => ({
          id: n.id,
          workflowId,
          type: n.type,
          label: n.label,
          positionX: n.positionX ?? 0,
          positionY: n.positionY ?? 0,
          config: n.config ?? {},
        })),
      });

      if (edges?.length) {
        await tx.workflowEdge.createMany({
          data: edges.map((e) => ({
            workflowId,
            sourceNodeId: e.sourceNodeId,
            targetNodeId: e.targetNodeId,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            label: e.label,
            condition: e.condition ?? undefined,
          })),
        });
      }
    });
  }
}
