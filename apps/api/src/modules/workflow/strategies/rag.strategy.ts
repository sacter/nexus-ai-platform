import { Injectable } from '@nestjs/common';

@Injectable()
export class RagStrategy {
  execute() {
    return 'RagStrategy';
  }
}
