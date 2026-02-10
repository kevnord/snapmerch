// SnapMerch Types

export interface CarIdentity {
  year: string;
  make: string;
  model: string;
  trim: string;
  color: { name: string; hex: string };
}

export type SnapMerchStyle =
  | 'vector' | 'retro' | 'calligram' | 'neon'
  | 'watercolor' | 'comic' | 'blueprint' | 'pop-art'
  | 'pencil' | 'neon-80s' | 'lowrider' | 'japanese';

export interface StyleConfig {
  id: SnapMerchStyle;
  label: string;
  emoji: string;
  artStyle: string;
  color?: string;
  backgroundColor?: string;
}

export const STYLE_CONFIGS: StyleConfig[] = [
  { id: 'vector', label: 'Vector', emoji: '🎯', artStyle: 'Vector (Monochromatic)', backgroundColor: '#FFFFFF' },
  { id: 'retro', label: 'Retro Poster', emoji: '🎨', artStyle: 'Vintage Poster', backgroundColor: '#FFFFFF' },
  { id: 'calligram', label: 'Typography', emoji: '✍️', artStyle: 'Distressed', backgroundColor: '#FFFFFF' },
  { id: 'neon', label: 'Neon Glow', emoji: '💡', artStyle: 'Neon Sign', backgroundColor: '#000000' },
  { id: 'watercolor', label: 'Watercolor', emoji: '🎨', artStyle: 'Watercolor', backgroundColor: '#FFFFFF' },
  { id: 'comic', label: 'Comic Book', emoji: '💥', artStyle: 'Comic Book', backgroundColor: '#FFFFFF' },
  { id: 'blueprint', label: 'Blueprint', emoji: '📐', artStyle: 'Blueprint Style', backgroundColor: '#003366' },
  { id: 'pop-art', label: 'Pop Art', emoji: '🎭', artStyle: 'Pop Art', backgroundColor: '#FFFFFF' },
  { id: 'pencil', label: 'Pencil Sketch', emoji: '✏️', artStyle: 'Pencil Sketch', backgroundColor: '#FFFFFF' },
  { id: 'neon-80s', label: '80s Synthwave', emoji: '🌆', artStyle: 'Synthwave 80s', backgroundColor: '#1a0033' },
  { id: 'lowrider', label: 'Lowrider Art', emoji: '🔊', artStyle: 'Lowrider Airbrush', backgroundColor: '#FFFFFF' },
  { id: 'japanese', label: 'JDM Style', emoji: '🗾', artStyle: 'JDM Japanese', backgroundColor: '#000000' },
];

export interface GeneratedStyle {
  styleId: SnapMerchStyle;
  imageUrl: string | null;
  status: 'idle' | 'generating' | 'done' | 'error';
  error?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  emoji: string;
  basePrice: number;
  sizes?: string[];
  colors?: { name: string; hex: string }[];
}

export const PRODUCT_OPTIONS: ProductOption[] = [
  {
    id: 'tshirt',
    name: 'T-Shirt',
    emoji: '👕',
    basePrice: 29.99,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Navy', hex: '#001F3F' },
      { name: 'Heather Gray', hex: '#9CA3AF' },
      { name: 'Red', hex: '#C8102E' },
    ],
  },
  {
    id: 'hoodie',
    name: 'Hoodie',
    emoji: '🧥',
    basePrice: 49.99,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Navy', hex: '#001F3F' },
      { name: 'Heather Gray', hex: '#9CA3AF' },
      { name: 'Red', hex: '#C8102E' },
    ],
  },
  {
    id: 'mug',
    name: 'Coffee Mug',
    emoji: '☕',
    basePrice: 19.99,
    colors: [
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Black', hex: '#000000' },
    ],
  },
  {
    id: 'poster',
    name: 'Poster',
    emoji: '🖼️',
    basePrice: 34.99,
    sizes: ['12×18', '18×24', '24×36'],
  },
];

export interface MockupResult {
  productId: string;
  styleId: SnapMerchStyle;
  imageUrl: string | null;
  status: 'idle' | 'generating' | 'done' | 'error';
}

export interface OrderItem {
  productId: string;
  styleId: SnapMerchStyle;
  size?: string;
  color?: string;
  price: number;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Order {
  id: string;
  carSessionId: string;
  items: OrderItem[];
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: ShippingAddress;
  paymentId?: string;
  status: 'pending' | 'confirmed' | 'fulfilled';
  createdAt: number;
}

export interface CarSession {
  id: string;
  photoBase64: string;
  photoThumbnail?: string;
  identity: CarIdentity | null;
  styles: GeneratedStyle[];
  mockups: MockupResult[];
  orders: Order[];
  createdAt: number;
  shareUrl?: string;
}

export interface EventSession {
  id: string;
  name: string;
  date: string;
  cars: CarSession[];
  createdAt: number;
}

export type VendorTab = 'capture' | 'designs' | 'dashboard';
