import type { Component } from 'vue'
import { Search, Document, QuestionFilled, EditPen } from '@element-plus/icons-vue'

export interface ChatSuggestion {
  icon: Component
  title: string
  text: string
}

export const DEFAULT_SUGGESTIONS: ChatSuggestion[] = [
  { icon: Search, title: '知识库问答', text: '这个知识库包含哪些文档？' },
  { icon: Document, title: '内容总结', text: '请帮我总结最新的规定' },
  { icon: QuestionFilled, title: '常见问题', text: '大家最常问的问题有哪些？' },
  { icon: EditPen, title: '起草文档', text: '帮我起草一份季度总结' },
]
