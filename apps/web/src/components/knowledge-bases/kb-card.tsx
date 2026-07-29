import { Card } from '@heroui/react';

export interface KbCardProps {
  name: string;
  description: string;
  kbImg: string;
  docCount: number;
  href: string;
}

export function KbCard({ name, description, docCount, kbImg }: KbCardProps) {
  return (
    <Card className="w-full items-stretch md:flex-row">
      <div className="relative h-[140px] w-full shrink-0 overflow-hidden rounded-2xl sm:h-[120px] sm:w-[120px]">
        <img
          alt={name}
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover select-none"
          loading="lazy"
          src={kbImg}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <Card.Header className="gap-1">
          <Card.Title className="pr-8 text-lg">{name}</Card.Title>
          <Card.Description>
            {description}
          </Card.Description>
        </Card.Header>
        <Card.Footer className="mt-auto flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">文档数量：{docCount} 件</span>
            <span className="text-xs text-muted">创建日期：2023-04-01</span>
          </div>
        </Card.Footer>
      </div>
    </Card>
  );
}
