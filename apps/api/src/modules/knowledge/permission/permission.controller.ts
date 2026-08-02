import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { BatchAssignPermissionDto } from './dto/batch-assign-permission.dto';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../common/decorators/current-user.decorator';

@Controller('knowledge-base/:kbId/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('me')
  findMyPermission(
    @Param('kbId') kbId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.permissionService.findMyPermission(kbId, user.sub);
  }

  @Get()
  findAll(@Param('kbId') kbId: string) {
    return this.permissionService.findAllByKb(kbId);
  }

  @Post()
  assign(
    @Param('kbId') kbId: string,
    @Body() createPermissionDto: CreatePermissionDto,
  ) {
    return this.permissionService.assign(kbId, createPermissionDto);
  }

  @Post('batch')
  batchAssign(
    @Param('kbId') kbId: string,
    @Body() batchAssignPermissionDto: BatchAssignPermissionDto,
  ) {
    return this.permissionService.batchAssign(kbId, batchAssignPermissionDto);
  }

  @Patch(':permissionId')
  update(
    @Param('kbId') kbId: string,
    @Param('permissionId') permissionId: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionService.update(
      kbId,
      permissionId,
      updatePermissionDto,
    );
  }

  @Delete(':permissionId')
  remove(
    @Param('kbId') kbId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.permissionService.remove(kbId, permissionId);
  }
}
