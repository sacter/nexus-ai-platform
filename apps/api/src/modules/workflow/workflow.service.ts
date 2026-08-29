import { Injectable } from '@nestjs/common';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { PrismaService } from '@nexus/database';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  create(createWorkflowDto: CreateWorkflowDto) {
    return 'This action adds a new workflow';
  }

  findAll() {
    return this.prisma.workflow.findMany();
  }

  findOne(id: string) {
    return `This action returns a #${id} workflow`;
  }

  update(id: string, updateWorkflowDto: UpdateWorkflowDto) {
    return `This action updates a #${id} workflow`;
  }

  remove(id: string) {
    return `This action removes a #${id} workflow`;
  }
}
