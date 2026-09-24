import { fetchResourcesPageData } from '@/lib/resources/queries'
import { requireSuperAdmin } from '@/lib/auth/requireUser'

export default async function AdminResourcesPage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null
  const { items, error } = await fetchResourcesPageData()
  return <div className="sg-admin-page">{error ? <p className="sg-admin-state sg-admin-state--error">资源暂时无法加载。</p> : items.length === 0 ? <p className="sg-admin-state">暂无资源。</p> : <div className="sg-admin-table-wrap"><table className="sg-admin-table"><thead><tr><th>名称</th><th>分类</th><th>链接</th><th>点击</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.category}</td><td><a href={item.url} target="_blank" rel="noreferrer">打开资源</a></td><td>{item.clickCount ?? '-'}</td></tr>)}</tbody></table></div>}</div>
}
