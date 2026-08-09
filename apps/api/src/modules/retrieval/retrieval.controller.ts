import { Controller, Post, Body } from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { SearchDto } from './dto/search.dto';

@Controller('retrieval')
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post('search')
  search(@Body() dto: SearchDto) {
    return this.retrievalService.search(dto);
  }
}
