<script setup lang="ts">
import { site } from '~/data/site'
import { MEMBER_GROUPS, MEMBER_ROLES, hasMemberSeason, matchesMember, memberGroups, memberSeasons, seasonFilterLabel, type Member } from '~/utils/members'

useHead({ title: `成员 | ${site.fullName}` })
const { data: rawMembers } = await useAsyncData('members:list', () => queryCollection('members').all() as Promise<Member[]>)
const search = ref('')
const selectedSeason = ref('all')
const selectedKind = ref('all')
const selectedGroup = ref('all')
const selectedRole = ref('all')

const allMembers = computed(() => [...(rawMembers.value || [])].sort((a, b) => {
  const yearDiff = (memberSeasons(b)[0]?.year || 0) - (memberSeasons(a)[0]?.year || 0)
  return yearDiff || a.name.localeCompare(b.name, 'zh-CN')
}))
const seasonTabs = computed(() => [
  { label: '全部赛季', value: 'all' },
  ...[...new Set(allMembers.value.flatMap(member => member.seasons.map(item => item.year)))]
    .sort((a, b) => b - a).map(year => ({ label: seasonFilterLabel(year), value: String(year) }))
])
const kindDefs = [{ value: 'all', label: '全部人员' }, { value: 'teacher', label: '指导老师' }, { value: 'student', label: '学生成员' }]
const groupDefs = [{ value: 'all', label: '全部组别' }, ...MEMBER_GROUPS.map(value => ({ value, label: value }))]
const roleDefs = [{ value: 'all', label: '全部职务' }, ...MEMBER_ROLES.map(value => ({ value, label: value }))]

// 切到老师时清除仅适用于学生的筛选，避免显示一个无意义的空列表。
watch(selectedKind, kind => {
  if (kind === 'teacher') { selectedGroup.value = 'all'; selectedRole.value = 'all' }
})
const filteredMembers = computed(() => allMembers.value.filter(member => matchesMember(member, {
  season: selectedSeason.value, kind: selectedKind.value, group: selectedGroup.value,
  role: selectedRole.value, search: search.value
})))
const sectionFor = (member: Member) => member.kind === 'teacher' ? '指导老师'
  : selectedGroup.value !== 'all' ? selectedGroup.value : memberGroups(member, selectedSeason.value)[0]
const groupedMembers = computed(() => ['指导老师', ...MEMBER_GROUPS]
  .map(label => ({ label, members: filteredMembers.value.filter(member => sectionFor(member) === label) }))
  .filter(group => group.members.length))
const stats = computed(() => [
  { value: allMembers.value.filter(member => member.kind === 'student').length, label: '学生档案' },
  { value: allMembers.value.filter(member => member.kind === 'teacher' && hasMemberSeason(member, selectedSeason.value)).length, label: '指导老师' },
  { value: filteredMembers.value.length, label: '当前筛选' },
  { value: MEMBER_GROUPS.length, label: '成员组别' }
])
</script>

<template>
  <main>
    <section class="page-hero members-hero">
      <div>
        <p class="eyebrow">Team Roster</p>
        <h1>成员</h1>
        <p>按赛季、组别和职务浏览战队成员与指导老师档案。</p>
      </div>
    </section>
    <section class="stats-band members-stats" aria-label="成员概览">
      <div v-for="item in stats" :key="item.label" class="stat-item"><strong>{{ item.value }}</strong><span>{{ item.label }}</span></div>
    </section>
    <section class="member-controls" aria-label="成员筛选">
      <div class="member-search">
        <label for="member-search">搜索成员</label>
        <input id="member-search" v-model="search" type="search" placeholder="姓名、学院、组别、职务或赛季">
      </div>
      <div class="member-filter">
        <span class="member-filter-label">赛季</span>
        <div class="filter-row" aria-label="赛季筛选">
          <button v-for="season in seasonTabs" :key="season.value" class="filter-chip" :class="{ active: selectedSeason === season.value }" :aria-pressed="selectedSeason === season.value" type="button" @click="selectedSeason = season.value">{{ season.label }}</button>
        </div>
      </div>
      <div class="member-filter">
        <span class="member-filter-label">身份</span>
        <div class="filter-row" aria-label="身份筛选">
          <button v-for="kind in kindDefs" :key="kind.value" class="filter-chip" :class="{ active: selectedKind === kind.value }" :aria-pressed="selectedKind === kind.value" type="button" @click="selectedKind = kind.value">{{ kind.label }}</button>
        </div>
      </div>
      <template v-if="selectedKind !== 'teacher'">
        <div class="member-filter">
          <span class="member-filter-label">组别</span>
          <div class="filter-row" aria-label="组别筛选">
            <button v-for="group in groupDefs" :key="group.value" class="filter-chip" :class="{ active: selectedGroup === group.value }" :aria-pressed="selectedGroup === group.value" type="button" @click="selectedGroup = group.value">{{ group.label }}</button>
          </div>
        </div>
        <div class="member-filter">
          <span class="member-filter-label">职务</span>
          <div class="filter-row" aria-label="职务筛选">
            <button v-for="role in roleDefs" :key="role.value" class="filter-chip" :class="{ active: selectedRole === role.value }" :aria-pressed="selectedRole === role.value" type="button" @click="selectedRole = role.value">{{ role.label }}</button>
          </div>
        </div>
      </template>
    </section>
    <section class="member-directory" aria-label="成员列表">
      <div v-if="groupedMembers.length" class="member-groups">
        <section v-for="group in groupedMembers" :key="group.label" class="member-group">
          <div class="section-heading compact"><p class="eyebrow">{{ group.members.length }} 人</p><h2>{{ group.label }}</h2></div>
          <div class="member-grid"><MemberCard v-for="member in group.members" :key="member.name" :member="member" :season="selectedSeason" /></div>
        </section>
      </div>
      <div v-else class="empty-state">没有匹配的成员。</div>
    </section>
  </main>
</template>
