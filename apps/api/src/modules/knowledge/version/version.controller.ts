import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { VersionService } from './version.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';

/**
 * 版本控制器
 *
 * 路由前缀：/api/v1/versions
 */
@Controller('versions')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Post()
  create(@Body() createVersionDto: CreateVersionDto) {
    return this.versionService.create(createVersionDto);
  }

  @Get()
  findAll(@Query('documentId') documentId?: string) {
    if (documentId) {
      return this.versionService.findByDocumentId(documentId);
    }
    return this.versionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.versionService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVersionDto: UpdateVersionDto,
  ) {
    return this.versionService.update(id, updateVersionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.versionService.remove(id);
  }
}
