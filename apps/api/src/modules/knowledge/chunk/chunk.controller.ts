import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ChunkService } from './chunk.service';

/**
 * 切片控制器
 *
 * 路由前缀：/api/v1/knowledge-bases/:kbId/chunks
 * 安全：读接口沿用全局 AuthGuard（与 GET documents 一致），viewer 可查看
 */
@Controller('knowledge-bases/:kbId/chunks')
export class ChunkController {
  constructor(private readonly chunkService: ChunkService) {}

  /**
   * GET /api/v1/knowledge-bases/:kbId/chunks?documentId=&page=&pageSize=
   * 分页查询切片；documentId 缺省 = 全部文档
   */
  @Get()
  list(
    @Param('kbId') kbId: string,
    @Query('documentId') documentId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.chunkService.listChunks(kbId, { documentId, page, pageSize });
  }
}
