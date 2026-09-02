import { Injectable } from '@nestjs/common';

@Injectable()
export class ReflectionStrategy {
  execute() {
    return 'ReflectionStrategy';
  }
}
