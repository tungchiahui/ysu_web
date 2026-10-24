<script setup lang="ts">
import type { DashboardTask } from '~/utils/dashboard'
import { dashboardUrgency } from '../../utils/dashboard-experience.mjs'
defineProps<{ task: DashboardTask; currentTime: number; paginated: boolean; profileFor: (name: string) => { href: string; image: string } }>()
const emit = defineEmits<{ open: [id: string] }>()
const priorityLabels = { high: '高优先级', medium: '中优先级', low: '低优先级' }
</script>

<template>
  <div class="dashboard-task-top"><span v-if="task.group" class="dashboard-tag" :title="task.group">{{ task.group }}</span><div class="dashboard-task-flags"><span v-if="dashboardUrgency(task, currentTime)" class="dashboard-urgency" :class="dashboardUrgency(task, currentTime)!.level">{{ dashboardUrgency(task, currentTime)!.label }}</span><span class="dashboard-priority" :class="task.priority">{{ priorityLabels[task.priority] }}</span></div></div>
  <h3><button type="button" class="dashboard-task-title" :aria-label="`查看任务详情：${task.title}`" @click="emit('open', task.id)">{{ task.title }}</button></h3>
  <div class="dashboard-assignees"><span class="dashboard-label">执行人</span><span v-if="!task.assignees.length">待分配</span><DashboardMember v-for="person in paginated ? task.assignees.slice(0, 2) : task.assignees" :key="person.key" :person="person" :profile="profileFor(person.name)" /><button v-if="paginated && task.assignees.length > 2" type="button" class="dashboard-more-people" :aria-label="`另有${task.assignees.length - 2}位执行人，查看全部`" @click="emit('open', task.id)">+{{ task.assignees.length - 2 }}</button></div>
  <p v-if="task.note" class="dashboard-note" :title="task.note">{{ task.note }}</p>
  <div class="dashboard-task-meta" :class="{ 'has-publisher': task.publisher }"><DashboardTaskTiming :task="task" :now="currentTime" /><span v-if="task.publisher" class="dashboard-publishers"><span class="dashboard-publisher-label">发布人</span> <DashboardMember v-for="person in task.publishers || [{ key: task.publisher, name: task.publisher, avatar: '' }]" :key="person.key" :person="person" :profile="profileFor(person.name)" /></span></div>
</template>
