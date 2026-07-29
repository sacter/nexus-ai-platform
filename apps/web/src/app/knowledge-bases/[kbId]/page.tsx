'use client';

import { use, useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Tabs,
  Tab,
  TabPanel,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  TableContent,
  Button,
  Badge,
  Input,
  Dropdown,
  Card,
  Chip
} from '@heroui/react';
import {
  Upload,
  Search,
  MoreHorizontal,
  FileText,
  List,
  FolderTree,
  Trash2,
  Download,
  Eye,
  ChevronDown,
  FileUp
} from 'lucide-react';
import { KNOWLEDGE_BASES, EMPTY_DOCUMENTS, type Document } from '../data';
import { setBreadcrumbLabels } from '@/config/breadcrumb-context';

function DocumentEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <FileUp className="w-20 h-20 text-blue-500 mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">请先导入文档</h3>
      <p className="text-sm text-foreground/50">为你的知识库添加文档以开始问答</p>
    </div>
  );
}

function DocumentStatusBadge({ status }: { status: Document['status'] }) {
  const statusConfig: Record<Document['status'], { color: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
    ready: { color: 'success', label: '已就绪' },
    processing: { color: 'warning', label: '处理中' },
    pending: { color: 'default', label: '等待中' },
    error: { color: 'danger', label: '失败' },
  };
  const config = statusConfig[status];
  return (
    <Badge color={config.color} variant="soft" size="sm">
      {config.label}
    </Badge>
  );
}

function DocumentTableRowActions({ doc }: { doc: Document }) {
  void doc;
  return (
    <div className="flex items-center gap-1">
      <Button isIconOnly size="sm" variant="ghost" aria-label="预览">
        <Eye className="w-4 h-4" />
      </Button>
      <Button isIconOnly size="sm" variant="ghost" aria-label="下载">
        <Download className="w-4 h-4" />
      </Button>
      <Button isIconOnly size="sm" variant="danger" aria-label="删除">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function SortDropdown({
  sortBy,
  onSortChange,
}: {
  sortBy: string;
  onSortChange: (key: string) => void;
}) {
  const sortLabels: Record<string, string> = {
    name: '名称',
    time: '上传时间',
    size: '大小',
  };

  return (
    <Dropdown.Root>
      <Dropdown.Trigger>
        <span className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg cursor-pointer hover:bg-default-100 transition-colors outline-none">
          {sortLabels[sortBy]}
          <ChevronDown className="w-3 h-3" />
        </span>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu
          selectionMode="single"
          selectedKeys={[sortBy]}
          onAction={(key) => onSortChange(key as string)}
        >
          <Dropdown.Item key="name">名称</Dropdown.Item>
          <Dropdown.Item key="time">上传时间</Dropdown.Item>
          <Dropdown.Item key="size">大小</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

function DocumentsTabPanel({ documents }: { documents: Document[] }) {
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [sortBy, setSortBy] = useState('name');

  if (documents.length === 0) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="primary">
            <Upload className="w-4 h-4 mr-1" />
            上传文档
          </Button>
          <div className="flex items-center gap-2">
            <SortDropdown sortBy={sortBy} onSortChange={setSortBy} />
            <div className="relative">
              <Search className="w-4 h-4 text-default-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="搜索文档名称"
                className="w-56 pl-8"
              />
            </div>
            <div className="flex items-center border border-default-200 rounded-lg overflow-hidden">
              <Button
                size="sm"
                isIconOnly
                variant={viewMode === 'list' ? 'primary' : 'ghost'}
                onPress={() => setViewMode('list')}
                aria-label="文档列表"
                className="rounded-none"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant={viewMode === 'tree' ? 'primary' : 'ghost'}
                onPress={() => setViewMode('tree')}
                aria-label="目录视图"
                className="rounded-none"
              >
                <FolderTree className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <Table>
          <TableContent aria-label="文档列表">
            <TableHeader>
              <TableColumn>文档名称 / ID</TableColumn>
              <TableColumn>文档状态</TableColumn>
              <TableColumn>处理面板</TableColumn>
              <TableColumn>切片数</TableColumn>
              <TableColumn>导入方式</TableColumn>
              <TableColumn>上传时间</TableColumn>
              <TableColumn>更新时间</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody>
              <TableRow key="empty" className="h-64">
                <TableCell colSpan={8}>
                  <DocumentEmptyState />
                </TableCell>
              </TableRow>
            </TableBody>
          </TableContent>
        </Table>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <Button variant="primary">
          <Upload className="w-4 h-4 mr-1" />
          上传文档
        </Button>
        <div className="flex items-center gap-2">
          <SortDropdown sortBy={sortBy} onSortChange={setSortBy} />
          <div className="relative">
            <Search className="w-4 h-4 text-default-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="搜索文档名称"
              className="w-56 pl-8"
            />
          </div>
        </div>
      </div>
      <Table>
        <TableContent aria-label="文档列表">
          <TableHeader>
            <TableColumn>文档名称 / ID</TableColumn>
            <TableColumn>文档状态</TableColumn>
            <TableColumn>处理面板</TableColumn>
            <TableColumn>切片数</TableColumn>
            <TableColumn>导入方式</TableColumn>
            <TableColumn>上传时间</TableColumn>
            <TableColumn>更新时间</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{doc.name}</span>
                    <span className="text-xs text-foreground/40">{doc.id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={doc.status} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground/60">--</span>
                </TableCell>
                <TableCell>{doc.chunkCount}</TableCell>
                <TableCell>
                  <span className="text-sm text-foreground/60">{doc.importMethod}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground/60">{doc.uploadTime}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground/60">{doc.updateTime}</span>
                </TableCell>
                <TableCell>
                  <DocumentTableRowActions doc={doc} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableContent>
      </Table>
    </div>
  );
}

export default function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = use(params);
  const kb = KNOWLEDGE_BASES.find((item) => item.id === kbId);

  useEffect(() => {
    if (kb) {
      setBreadcrumbLabels({ [kbId]: kb.name });
    }
    return () => {
      setBreadcrumbLabels({});
    };
  }, [kbId, kb]);

  return (
    <MainLayout>
      <Card className="rounded-lg">
        <Card.Content>
          <div className="mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <div className="w-12 h-14 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0">
                  <FileText className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-xl font-bold text-foreground">{kb?.name ?? '知识库概览'}</h1>
                    <Chip color="success" variant="primary">
                      <Chip.Label className="text-white">活跃</Chip.Label>
                    </Chip>
                  </div>
                  {kb && (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-foreground/50">
                      <span>
                        ID: <span className="text-foreground/70 font-mono">{kb.id}</span>
                      </span>
                      <span>
                        创建时间: <span className="text-foreground/70">{kb.createTime}</span>
                      </span>
                      <span>
                        更新时间: <span className="text-foreground/70">{kb.updateTime}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dropdown.Root>
                  <Dropdown.Trigger>
                    <span className="inline-flex items-center justify-center p-2 rounded-lg cursor-pointer hover:bg-default-100 transition-colors outline-none" aria-label="更多操作">
                      <MoreHorizontal className="w-5 h-5" />
                    </span>
                  </Dropdown.Trigger>
                  <Dropdown.Popover>
                    <Dropdown.Menu>
                      <Dropdown.Item key="edit">编辑知识库</Dropdown.Item>
                      <Dropdown.Item key="delete" className="text-danger">
                        删除知识库
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
              </div>
            </div>

            {kb && (
              <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50">文档类型:</span>
                  <span className="text-foreground/80">{kb.docType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50">描述:</span>
                  <span className="text-foreground/80">{kb.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50">分片类型:</span>
                  <span className="text-foreground/80">{kb.chunkType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50">索引方式:</span>
                  <span className="text-foreground/80">{kb.indexMode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50">向量模型:</span>
                  <span className="text-foreground/80">{kb.embeddingModel}</span>
                </div>
              </div>
            )}
          </div>
          <Tabs className="w-full">
            <Tabs.ListContainer className="w-full max-w-md">
              <Tabs.List aria-label="知识库标签" className="*:data-[selected=true]:bg-white">
                <Tab id="documents">原始文档</Tab>
                <Tab id="chunks">切片详情</Tab>
                <Tab id="search">知识检索</Tab>
                <Tab id="qa">知识问答</Tab>
              </Tabs.List>
            </Tabs.ListContainer>
            <TabPanel id="documents">
              <DocumentsTabPanel documents={EMPTY_DOCUMENTS} />
            </TabPanel>
            <TabPanel id="chunks">
              <div className="mt-4 flex items-center justify-center py-20">
                <div className="text-center">
                  <p className="text-foreground/60 text-sm">暂无切片数据</p>
                </div>
              </div>
            </TabPanel>
            <TabPanel id="search">
              <div className="mt-4 flex items-center justify-center py-20">
                <div className="text-center">
                  <p className="text-foreground/60 text-sm">请先导入文档以启用知识检索</p>
                </div>
              </div>
            </TabPanel>
            <TabPanel id="qa">
              <div className="mt-4 flex items-center justify-center py-20">
                <div className="text-center">
                  <p className="text-foreground/60 text-sm">请先导入文档以启用知识问答</p>
                </div>
              </div>
            </TabPanel>
          </Tabs>
        </Card.Content>
      </Card>
    </MainLayout>
  );
}