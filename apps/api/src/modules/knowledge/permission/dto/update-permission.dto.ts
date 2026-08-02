import { IsEnum } from 'class-validator';
import { KbRole } from '@prisma/client';

export class UpdatePermissionDto {
  @IsEnum(KbRole)
  role!: KbRole;
}
