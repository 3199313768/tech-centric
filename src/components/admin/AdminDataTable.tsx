'use client'

import Link from 'next/link'
import { Table, Tag, type TableColumn } from '@oxygen-design/ui'
import type { ResourceItem } from '@/data/resources/initialResources'
import type { AgentSkill } from '@/lib/skills/queries'

const resourceColumns: TableColumn<ResourceItem>[] = [
  {
    key: 'name',
    dataIndex: 'name',
    title: '名称',
    render: (value, record) => (
      <span>
        {String(value)}
        {record.description ? (
          <span className="oxygen-admin-table__secondary">{record.description}</span>
        ) : null}
      </span>
    ),
  },
  { key: 'category', dataIndex: 'category', title: '分类' },
  {
    key: 'url',
    dataIndex: 'url',
    title: '链接',
    render: (value) => (
      <Link className="oxygen-admin-link" href={String(value)} target="_blank" rel="noreferrer">
        打开资源
      </Link>
    ),
  },
  {
    key: 'clickCount',
    dataIndex: 'clickCount',
    title: '点击',
    render: (value) => value == null ? '-' : String(value),
  },
]

const skillColumns: TableColumn<AgentSkill>[] = [
  {
    key: 'name',
    dataIndex: 'name',
    title: '技能',
    render: (value, record) => (
      <span>
        <span aria-hidden>{record.icon}</span> {String(value)}
      </span>
    ),
  },
  { key: 'description', dataIndex: 'description', title: '说明', ellipsis: true },
  {
    key: 'platform',
    dataIndex: 'platform',
    title: '平台',
    render: (value) => value == null ? '-' : String(value),
  },
  {
    key: 'tags',
    dataIndex: 'tags',
    title: '标签',
    render: (_, record) => record.tags.length > 0 ? (
      <span className="oxygen-admin-tag-list">
        {record.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
      </span>
    ) : '-',
  },
]

export function ResourceAdminTable({ items }: { items: ResourceItem[] }) {
  return <Table columns={resourceColumns} dataSource={items} rowKey="id" emptyText="暂无资源。" />
}

export function SkillAdminTable({ skills }: { skills: AgentSkill[] }) {
  return <Table columns={skillColumns} dataSource={skills} rowKey="id" emptyText="暂无技能。" />
}
