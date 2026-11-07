<script setup lang="ts">
import { site } from '~/data/site'
import { MEMBER_GROUPS, MEMBER_ROLES, matchesMember, memberSections, memberSeasons, seasonFilterLabel, type Member } from '~/utils/members'

useHead({ title: `成员 | ${site.fullName}` })
const { data: rawMembers } = await useAsyncData('members:list', () => queryCollection('members').all() as Promise<Member[]>)
const search = ref('')
const selectedSeason = ref('2027')
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
const groupedMembers = computed(() => memberSections(filteredMembers.value,
  selectedSeason.value, selectedGroup.value, selectedRole.value))
const seasonHeading = computed(() => selectedSeason.value === 'all' ? '全部赛季' : `${selectedSeason.value} 赛季`)
const clearFilters = () => {
  search.value = ''
  selectedSeason.value = '2027'
  selectedKind.value = 'all'
  selectedGroup.value = 'all'
  selectedRole.value = 'all'
}
</script>

<template>
  <main class="roster-page editorial-wrap">
    <header class="roster-heading">
      <div><h1>成员</h1><p>按赛季、组别和职务浏览战队成员与指导老师档案。</p></div>
      <p class="roster-current" role="status" aria-live="polite">{{ seasonHeading }}<span>{{ filteredMembers.length }} 人</span></p>
    </header>
    <section class="roster-controls" aria-label="成员筛选">
      <div class="roster-primary-controls">
        <div class="roster-seasons" aria-label="赛季筛选">
          <button v-for="season in seasonTabs" :key="season.value" class="roster-season" :aria-pressed="selectedSeason === season.value" type="button" @click="selectedSeason = season.value">{{ season.label }}</button>
        </div>
        <div class="roster-search"><label class="visually-hidden" for="member-search">搜索成员</label><input id="member-search" v-model="search" type="search" placeholder="搜索姓名、学院或职务"></div>
      </div>
      <div class="roster-secondary-controls">
        <label class="roster-select">身份<select v-model="selectedKind" aria-label="身份"><option v-for="kind in kindDefs" :key="kind.value" :value="kind.value">{{ kind.label }}</option></select></label>
        <template v-if="selectedKind !== 'teacher'">
          <label class="roster-select">组别<select v-model="selectedGroup" aria-label="组别"><option v-for="group in groupDefs" :key="group.value" :value="group.value">{{ group.label }}</option></select></label>
          <label class="roster-select">职务<select v-model="selectedRole" aria-label="职务"><option v-for="role in roleDefs" :key="role.value" :value="role.value">{{ role.label }}</option></select></label>
        </template>
        <p class="roster-archive-note">全部档案：{{ allMembers.filter(member => member.kind === 'student').length }} 位学生 · {{ allMembers.filter(member => member.kind === 'teacher').length }} 位指导老师 · {{ MEMBER_GROUPS.length }} 个组别</p>
      </div>
    </section>
    <section class="roster-directory" aria-label="成员列表">
      <div v-if="groupedMembers.length" class="roster-groups">
        <section v-for="group in groupedMembers" :key="group.label" class="roster-group" :class="{ 'roster-group-teachers': group.label === '指导老师' }">
          <div class="roster-group-heading"><h2>{{ group.label }}</h2><span>{{ group.members.length }} 人</span></div>
          <div class="roster-grid"><MemberCard v-for="member in group.members" :key="member.name" :member="member" :season="selectedSeason" directory /></div>
        </section>
      </div>
      <div v-else class="roster-empty"><h2>没有匹配的成员</h2><p>可以更换关键词，或调整赛季、组别和职务。</p><button class="editorial-action secondary" type="button" @click="clearFilters">重置筛选</button></div>
    </section>
  </main>
</template>
