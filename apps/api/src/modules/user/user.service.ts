import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

/**
 * 统一在 Prisma 查询层排除 passwordHash，
 * 避免各调用方遗漏导致密码哈希泄漏。
 */
const SAFE_USER = { passwordHash: true } as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { password, ...rest } = createUserDto;
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { ...rest, passwordHash },
      omit: SAFE_USER,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      omit: SAFE_USER,
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      omit: SAFE_USER,
    });
  }

  /**
   * 仅 AuthService 内部使用，需要 passwordHash 做密码校验。
   * 外部调用请使用 findOne()。
   */
  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      omit: SAFE_USER,
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { password, ...rest } = updateUserDto;
    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      omit: SAFE_USER,
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
      omit: SAFE_USER,
    });
  }
}
