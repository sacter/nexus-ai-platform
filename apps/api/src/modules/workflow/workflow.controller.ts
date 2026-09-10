import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowService } from './workflow.service';
import { ExecutionService } from './execution.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ExecuteWorkflowDto } from './dto/execute-workflow.dto';
import { PaginationDto } from './dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly executionService: ExecutionService,
  ) {}

  @Post()
  create(
    @Body() createWorkflowDto: CreateWorkflowDto,
    @CurrentUser('sub') sub: string,
  ) {
    return this.workflowService.create(createWorkflowDto, sub);
  }

  @Get()
  findAll() {
    return this.workflowService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ) {
    return this.workflowService.update(id, updateWorkflowDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.remove(id);
  }

  // ── 执行相关 ──

  @Post(':id/run')
  async run(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteWorkflowDto,
  ) {
    return this.executionService.execute(id, dto, 'system');
  }

  @Get(':id/executions')
  async getExecutions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.executionService.listByWorkflow(id, query);
  }

  @Get(':id/executions/:execId')
  async getExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('execId', ParseUUIDPipe) execId: string,
  ) {
    return this.executionService.getById(id, execId);
  }

  @Post(':id/executions/:execId/resume')
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('execId', ParseUUIDPipe) execId: string,
  ) {
    return this.executionService.resume(execId);
  }

  // ── SSE 流式执行 ──

  @Post(':id/stream')
  async runStream(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteWorkflowDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 设置 SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const executionId = uuidv4();

    // 监听客户端断开
    req.on('close', () => {
      res.end();
    });

    try {
      const stream = await this.executionService.executeStream(
        id,
        dto,
        'system',
        executionId,
      );
      for await (const event of stream) {
        if (res.destroyed) break;
        res.write(`event: step\ndata: ${JSON.stringify(event)}\n\n`);
      }
      if (!res.destroyed) {
        res.write(`event: done\ndata: ${JSON.stringify({ executionId })}\n\n`);
      }
    } catch (err: unknown) {
      if (!res.destroyed) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
        );
      }
    } finally {
      if (!res.destroyed) res.end();
    }
  }
}
