import { dashboardMemberPath } from './dashboard-data.mjs'

const handle = value => typeof value === 'string' && /^[a-z\d_.-]+$/i.test(value) && !['.', '..'].includes(value) ? value.toLowerCase() : ''

export function gitcodeProfileLogin(value) {
  if (typeof value !== 'string') return ''
  const match = /^https:\/\/gitcode\.com\/([a-z\d_.-]+)\/?$/i.exec(value)
  return match ? handle(match[1]) : ''
}

function destination(value) {
  return typeof value === 'string' && /^https:\/\/gitcode\.com(?:\/[a-z\d_.-]+(?:\/[a-z\d_.-]+)?)?\/?$/i.test(value)
    && !value.split('/').some(part => part === '.' || part === '..') ? value : ''
}

export function dashboardCodeProfile(person, members = [], logo = '') {
  const login = gitcodeProfileLogin(person.href) || handle(person.login) || handle(person.name)
  const matches = person.memberName ? members.filter(member => member.name === person.memberName)
    : login ? members.filter(member => gitcodeProfileLogin(member.links?.gitcode) === login) : []
  const member = matches.length === 1 ? matches[0] : null
  if (member) return { name: member.name, image: member.image || logo,
    href: dashboardMemberPath(member.name, [member.name]), external: false }
  return { name: person.name || 'GitCode', image: logo, href: destination(person.href) || 'https://gitcode.com', external: true }
}
