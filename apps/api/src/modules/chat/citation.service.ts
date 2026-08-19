import { Injectable } from '@nestjs/common';

@Injectable()
export class CitationService {
  getCitation(): string {
    return 'This action returns a citation';
  }
}
