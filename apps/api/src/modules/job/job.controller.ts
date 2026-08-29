import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JobService } from './job.service';
import { ListJobsDto } from './dto/list-jobs.dto';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  findAll(@Query() query: ListJobsDto) {
    return this.jobService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobService.findOne(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.jobService.cancel(id);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.jobService.retry(id);
  }
}
