import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { ExecutionService } from './execution.service';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService, ExecutionService],
})
export class WorkflowModule {}
