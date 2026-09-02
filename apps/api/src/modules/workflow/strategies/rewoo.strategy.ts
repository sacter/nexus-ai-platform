import { Injectable } from '@nestjs/common';

@Injectable()
export class RewooStrategy {
  execute() {
    return 'RewooStrategy';
  }
}
