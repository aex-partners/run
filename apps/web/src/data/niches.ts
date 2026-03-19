// Business niches and sub-niches for Setup Wizard

export interface NicheOption {
  id: string
  label: string
  icon: string
  subNiches: SubNicheOption[]
}

export interface SubNicheOption {
  id: string
  label: string
}

export const NICHES: NicheOption[] = [
  {
    id: 'retail',
    label: 'Retail',
    icon: 'ShoppingBag',
    subNiches: [
      { id: 'clothing', label: 'Clothing & Fashion' },
      { id: 'electronics', label: 'Electronics' },
      { id: 'grocery', label: 'Grocery & Supermarket' },
      { id: 'furniture', label: 'Furniture & Home Decor' },
      { id: 'sports', label: 'Sports & Outdoors' },
      { id: 'beauty', label: 'Beauty & Cosmetics' },
      { id: 'pet', label: 'Pet Supplies' },
      { id: 'books', label: 'Books & Stationery' },
    ],
  },
  {
    id: 'food-beverage',
    label: 'Food & Beverage',
    icon: 'UtensilsCrossed',
    subNiches: [
      { id: 'restaurant', label: 'Restaurant' },
      { id: 'cafe', label: 'Cafe & Bakery' },
      { id: 'bar', label: 'Bar & Nightclub' },
      { id: 'catering', label: 'Catering' },
      { id: 'food-truck', label: 'Food Truck' },
      { id: 'delivery', label: 'Delivery Kitchen' },
      { id: 'brewery', label: 'Brewery & Winery' },
      { id: 'food-production', label: 'Food Production' },
    ],
  },
  {
    id: 'services',
    label: 'Professional Services',
    icon: 'Briefcase',
    subNiches: [
      { id: 'consulting', label: 'Consulting' },
      { id: 'accounting', label: 'Accounting & Finance' },
      { id: 'legal', label: 'Legal' },
      { id: 'marketing', label: 'Marketing & Advertising' },
      { id: 'it-services', label: 'IT Services' },
      { id: 'hr-services', label: 'HR & Recruiting' },
      { id: 'architecture', label: 'Architecture & Engineering' },
      { id: 'real-estate', label: 'Real Estate' },
      { id: 'insurance', label: 'Insurance' },
    ],
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    icon: 'Heart',
    subNiches: [
      { id: 'clinic', label: 'Medical Clinic' },
      { id: 'dental', label: 'Dental Practice' },
      { id: 'pharmacy', label: 'Pharmacy' },
      { id: 'veterinary', label: 'Veterinary' },
      { id: 'therapy', label: 'Therapy & Wellness' },
      { id: 'lab', label: 'Laboratory' },
      { id: 'optical', label: 'Optical' },
      { id: 'home-care', label: 'Home Care' },
    ],
  },
  {
    id: 'education',
    label: 'Education',
    icon: 'GraduationCap',
    subNiches: [
      { id: 'school', label: 'School' },
      { id: 'university', label: 'University & College' },
      { id: 'online-courses', label: 'Online Courses' },
      { id: 'tutoring', label: 'Tutoring' },
      { id: 'language', label: 'Language School' },
      { id: 'training', label: 'Corporate Training' },
      { id: 'daycare', label: 'Daycare & Preschool' },
      { id: 'driving-school', label: 'Driving School' },
    ],
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    icon: 'Factory',
    subNiches: [
      { id: 'textiles', label: 'Textiles' },
      { id: 'metals', label: 'Metals & Machinery' },
      { id: 'plastics', label: 'Plastics & Packaging' },
      { id: 'automotive-parts', label: 'Automotive Parts' },
      { id: 'electronics-mfg', label: 'Electronics Manufacturing' },
      { id: 'chemicals', label: 'Chemicals' },
      { id: 'woodwork', label: 'Woodwork & Carpentry' },
      { id: 'printing', label: 'Printing & Publishing' },
    ],
  },
  {
    id: 'construction',
    label: 'Construction',
    icon: 'HardHat',
    subNiches: [
      { id: 'residential', label: 'Residential' },
      { id: 'commercial', label: 'Commercial' },
      { id: 'renovation', label: 'Renovation & Remodeling' },
      { id: 'electrical', label: 'Electrical' },
      { id: 'plumbing', label: 'Plumbing' },
      { id: 'painting', label: 'Painting & Finishing' },
      { id: 'landscaping', label: 'Landscaping' },
      { id: 'demolition', label: 'Demolition' },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistics & Transportation',
    icon: 'Truck',
    subNiches: [
      { id: 'freight', label: 'Freight & Shipping' },
      { id: 'courier', label: 'Courier & Delivery' },
      { id: 'warehousing', label: 'Warehousing' },
      { id: 'fleet', label: 'Fleet Management' },
      { id: 'moving', label: 'Moving Services' },
      { id: 'customs', label: 'Customs Brokerage' },
      { id: 'passenger', label: 'Passenger Transport' },
      { id: 'cold-chain', label: 'Cold Chain Logistics' },
    ],
  },
  {
    id: 'technology',
    label: 'Technology',
    icon: 'Cpu',
    subNiches: [
      { id: 'saas', label: 'SaaS' },
      { id: 'ecommerce', label: 'E-commerce' },
      { id: 'mobile-apps', label: 'Mobile Apps' },
      { id: 'ai-ml', label: 'AI & Machine Learning' },
      { id: 'cybersecurity', label: 'Cybersecurity' },
      { id: 'devops', label: 'DevOps & Cloud' },
      { id: 'game-dev', label: 'Game Development' },
      { id: 'iot', label: 'IoT & Hardware' },
    ],
  },
  {
    id: 'hospitality',
    label: 'Hospitality & Tourism',
    icon: 'Hotel',
    subNiches: [
      { id: 'hotel', label: 'Hotel & Resort' },
      { id: 'hostel', label: 'Hostel & B&B' },
      { id: 'travel-agency', label: 'Travel Agency' },
      { id: 'event-venue', label: 'Event Venue' },
      { id: 'tour-operator', label: 'Tour Operator' },
      { id: 'spa', label: 'Spa & Wellness Center' },
      { id: 'camping', label: 'Camping & Outdoor' },
      { id: 'theme-park', label: 'Theme Park' },
    ],
  },
  {
    id: 'agriculture',
    label: 'Agriculture',
    icon: 'Sprout',
    subNiches: [
      { id: 'farming', label: 'Farming & Crops' },
      { id: 'livestock', label: 'Livestock' },
      { id: 'dairy', label: 'Dairy' },
      { id: 'aquaculture', label: 'Aquaculture & Fishery' },
      { id: 'agritech', label: 'Agritech' },
      { id: 'forestry', label: 'Forestry' },
      { id: 'organic', label: 'Organic & Sustainable' },
      { id: 'agribusiness', label: 'Agribusiness Trading' },
    ],
  },
]
