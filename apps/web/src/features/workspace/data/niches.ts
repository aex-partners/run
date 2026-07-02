// Business niches and sub-niches for Setup Wizard
// Labels come from i18n: niches.{i18nKey}.label / niches.{i18nKey}.subNiches.{subId}

export interface NicheOption {
  id: string
  i18nKey: string
  icon: string
  subNiches: string[]
}

export const NICHES: NicheOption[] = [
  {
    id: 'retail',
    i18nKey: 'retail',
    icon: 'ShoppingBag',
    subNiches: ['clothing', 'electronics', 'grocery', 'furniture', 'pharmacy', 'pet', 'sports', 'beauty', 'bookstore', 'jewelry', 'autoparts', 'convenience', 'ecommerce'],
  },
  {
    id: 'food-beverage',
    i18nKey: 'foodAndBeverage',
    icon: 'UtensilsCrossed',
    subNiches: ['restaurant', 'cafe', 'bakery', 'bar', 'fastFood', 'foodTruck', 'catering', 'brewery', 'mealPrep', 'iceCream'],
  },
  {
    id: 'services',
    i18nKey: 'professionalServices',
    icon: 'Briefcase',
    subNiches: ['accounting', 'legal', 'consulting', 'marketing', 'recruitment', 'insurance', 'realEstate', 'architecture', 'financial', 'translation'],
  },
  {
    id: 'healthcare',
    i18nKey: 'healthcare',
    icon: 'Heart',
    subNiches: ['clinic', 'dental', 'veterinary', 'psychology', 'physiotherapy', 'laboratory', 'homecare', 'nutrition', 'optometry', 'alternativeMedicine'],
  },
  {
    id: 'education',
    i18nKey: 'education',
    icon: 'GraduationCap',
    subNiches: ['school', 'university', 'languageSchool', 'onlineCourses', 'tutoring', 'vocational', 'earlyChildhood', 'musicArts', 'corporate', 'driving'],
  },
  {
    id: 'manufacturing',
    i18nKey: 'manufacturing',
    icon: 'Factory',
    subNiches: ['foodProcessing', 'textile', 'metalwork', 'plastics', 'woodwork', 'chemical', 'electronics', 'automotive', 'printing', 'construction'],
  },
  {
    id: 'construction',
    i18nKey: 'construction',
    icon: 'HardHat',
    subNiches: ['residential', 'commercial', 'renovation', 'electrical', 'plumbing', 'painting', 'roofing', 'landscaping', 'demolition', 'solarInstall'],
  },
  {
    id: 'logistics',
    i18nKey: 'logistics',
    icon: 'Truck',
    subNiches: ['freight', 'lastMile', 'warehouse', 'moving', 'courier', 'fleet', 'customs', 'coldChain', 'rideshare', 'maritime'],
  },
  {
    id: 'technology',
    i18nKey: 'technology',
    icon: 'Cpu',
    subNiches: ['saas', 'webDev', 'mobileDev', 'itServices', 'cybersecurity', 'dataAnalytics', 'aiMl', 'iot', 'gamedev', 'cloudHosting'],
  },
  {
    id: 'hospitality',
    i18nKey: 'hospitality',
    icon: 'Hotel',
    subNiches: ['hotel', 'hostel', 'travelAgency', 'tourOperator', 'eventVenue', 'camping', 'spa', 'themepark', 'vacation', 'ecotourism'],
  },
  {
    id: 'agriculture',
    i18nKey: 'agriculture',
    icon: 'Sprout',
    subNiches: ['cropFarming', 'livestock', 'dairy', 'poultry', 'aquaculture', 'organic', 'agribusiness', 'irrigation', 'forestry', 'horticulture'],
  },
]
