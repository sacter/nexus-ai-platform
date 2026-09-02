import { Injectable } from '@nestjs/common';

@Injectable()
export class MultiAgentStrategy {
  execute() {
    return 'MultiAgentStrategy';
  }
}
