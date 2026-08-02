import { IsUUID, IsEnum } from 'class-validator';
import { KbRole } from '@prisma/client';

export class CreatePermissionDto {
  @IsUUID()
  userId!: string;

  @IsEnum(KbRole)
  role!: KbRole;
}
