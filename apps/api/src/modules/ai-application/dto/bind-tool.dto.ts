import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class BindToolDto {
  @IsString()
  @IsNotEmpty()
  toolId!: string;

  /** 应用级工具配置覆盖（AiApplicationTool.config） */
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
