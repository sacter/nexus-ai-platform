import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { PublicKeyService } from '../auth/public-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('api-keys')
export class ApiKeyController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly publicKeyService: PublicKeyService,
  ) {}

  /** 获取 RSA-2048 公钥（前端加密密码用） */
  @Get('public-key')
  getPublicKey() {
    return { publicKey: this.publicKeyService.publicKey };
  }

  @Post()
  create(
    @Body() createApiKeyDto: CreateApiKeyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apiKeyService.create(createApiKeyDto, user.sub);
  }

  @Get()
  findAll() {
    return this.apiKeyService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateApiKeyDto: UpdateApiKeyDto) {
    return this.apiKeyService.update(id, updateApiKeyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.apiKeyService.remove(id);
  }
}
