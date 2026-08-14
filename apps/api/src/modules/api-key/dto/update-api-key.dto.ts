import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateApiKeyDto } from './create-api-key.dto';

export class UpdateApiKeyDto extends PartialType(CreateApiKeyDto) {
  /** 启用/停用；不在 CreateApiKeyDto 中，需在此显式声明否则会被 whitelist 剥离 */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
