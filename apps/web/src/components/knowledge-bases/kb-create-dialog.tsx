'use client';

import { useState, useRef, useCallback } from 'react';
import { Modal, Button, Switch, Tooltip } from '@heroui/react';
import { Upload, HelpCircle, X, FileText, FileUp } from 'lucide-react';

export interface UploadDocumentsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (files: File[], options: { dedup: boolean }) => void;
}

export function KbCreateDialog({
  isOpen,
  onOpenChange,
  onConfirm,
}: UploadDocumentsModalProps) {
  const [dedup, setDedup] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setFiles([]);
    setIsDragOver(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleConfirm = useCallback(() => {
    onConfirm?.(files, { dedup });
    handleClose();
  }, [files, dedup, onConfirm, handleClose]);

  const handleSelectFiles = useCallback(
    (selected: FileList | null) => {
      if (!selected) return;
      const next = Array.from(selected).slice(0, 100);
      setFiles((prev) => [...prev, ...next].slice(0, 100));
    },
    [],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      handleSelectFiles(event.dataTransfer.files);
    },
    [handleSelectFiles],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(true);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold text-foreground">
                上传文档
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="px-6 py-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`p-4 flex flex-col items-center justify-center min-h-[320px] border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-default-200 bg-default-50 hover:border-primary/50 hover:bg-default-100'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.epub,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    handleSelectFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                {/* 图标占位 - 按设计留白 */}
                <FileUp className="w-20 h-20 text-accent mb-4" />
                <div className="text-base font-medium text-primary mb-2">
                  <span className="text-accent">点击/拖拽</span> 文档/图片到此处
                </div>
                <p className="text-xs text-foreground/50 text-center max-w-md leading-relaxed">
                  支持文档、图片格式。文件如 PDF、Word、Excel、TXT、CSV
                  <br />
                  图片如 PNG、JPEG 等，一次最多可上传 100 个文件。
                </p>
                {files.length > 0 && (
                  <div className="mt-4 w-full max-w-md">
                    <p className="text-xs text-foreground/60 mb-2">
                      已选择 {files.length} 个文件
                    </p>
                    <ul className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                      {files.map((file, idx) => (
                        <li
                          key={`${file.name}-${idx}`}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-default-100 text-sm"
                        >
                          <FileText className="w-4 h-4 text-default-500 shrink-0" />
                          <span className="truncate flex-1 text-foreground/80">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFiles((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="p-0.5 rounded hover:bg-default-200 text-default-500"
                            aria-label="移除"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer className="flex items-center justify-between border-default-100">
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  isSelected={dedup}
                  onChange={setDedup}
                  size="sm"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
                <span className="text-sm text-foreground/80">文档去重</span>
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      type="button"
                      className="text-foreground/40 hover:text-foreground/60 transition-colors outline-none"
                      aria-label="文档去重说明"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    开启后，系统将自动跳过内容重复的文档
                  </Tooltip.Content>
                </Tooltip.Root>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onPress={handleClose}
                >
                  取消
                </Button>
                <Button
                  variant="primary"
                  onPress={handleConfirm}
                  isDisabled={files.length === 0}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  导入
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default KbCreateDialog;