import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VersionService } from './version.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';

@Controller('version')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Post()
  create(@Body() createVersionDto: CreateVersionDto) {
    return this.versionService.create(createVersionDto);
  }

  @Get()
  findAll() {
    return this.versionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.versionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVersionDto: UpdateVersionDto) {
    return this.versionService.update(+id, updateVersionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.versionService.remove(+id);
  }
}
