import { Module } from '@nestjs/common';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';
import { DenseRetriever } from './retrievers/dense-retriever';
import { SparseRetriever } from './retrievers/sparse-retriever';
import { RrfService } from './fusion/rrf.service';
import { BgeRerankerService } from './reranker/bge-reranker.service';
import { CohereRerankerService } from './reranker/cohere-reranker.service';
import { CitationService } from './citation/citation.service';

@Module({
  controllers: [RetrievalController],
  providers: [
    RetrievalService,
    DenseRetriever,
    SparseRetriever,
    RrfService,
    BgeRerankerService,
    CohereRerankerService,
    CitationService,
  ],
  exports: [RetrievalService],
})
export class RetrievalModule {}
