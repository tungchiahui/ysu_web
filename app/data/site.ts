import data from '../../.content-data/site.json'

type Site = Omit<typeof data, 'records'> & {
  records: Array<{ label: string; href: string }>
}

export const site: Site = data
