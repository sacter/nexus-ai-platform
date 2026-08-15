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
import { ModelService } from './model.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('models')
export class ModelController {
  constructor(private readonly modelService: ModelService) {}

  @Post()
  create(
    @Body() createModelDto: CreateModelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.modelService.create(createModelDto, user.sub);
  }

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('provider') provider?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.modelService.findAll({
      type: type as CreateModelDto['type'] | undefined,
      provider,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.modelService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateModelDto: UpdateModelDto) {
    return this.modelService.update(id, updateModelDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.modelService.remove(id);
  }
}
