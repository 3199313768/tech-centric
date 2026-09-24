import { fetchAiSkillsPageData } from '@/lib/skills/queries'
import { requireSuperAdmin } from '@/lib/auth/requireUser'

export default async function AdminSkillsPage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null
  const { skills, error } = await fetchAiSkillsPageData()
  return <div className="sg-admin-page">{error ? <p className="sg-admin-state sg-admin-state--error">技能暂时无法加载。</p> : skills.length === 0 ? <p className="sg-admin-state">暂无技能。</p> : <div className="sg-admin-table-wrap"><table className="sg-admin-table"><thead><tr><th>技能</th><th>说明</th><th>平台</th><th>标签</th></tr></thead><tbody>{skills.map((skill) => <tr key={skill.id}><td>{skill.icon} {skill.name}</td><td>{skill.description}</td><td>{skill.platform || '-'}</td><td>{skill.tags.join('、') || '-'}</td></tr>)}</tbody></table></div>}</div>
}
