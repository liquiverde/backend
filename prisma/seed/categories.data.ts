import { FALLBACK_CATEGORY_NAME } from '../../src/modules/categories/categories.service';

export interface CategorySeed {
  name: string;
  children?: string[];
}

/** ~8 root categories x ~2 children — enough hierarchy for the substitution
 *  engine (RF-06) to have a meaningful "same category / parent category" pool. */
export const CATEGORY_TREE: CategorySeed[] = [
  { name: 'Lácteos', children: ['Leches', 'Yogures y Postres'] },
  {
    name: 'Frutas y Verduras',
    children: ['Frutas Frescas', 'Verduras Frescas'],
  },
  { name: 'Panadería', children: ['Panes', 'Pastelería'] },
  { name: 'Snacks', children: ['Snacks Salados', 'Snacks Dulces'] },
  { name: 'Bebidas', children: ['Bebidas Gaseosas', 'Jugos y Aguas'] },
  {
    name: 'Despensa',
    children: ['Cereales y Legumbres', 'Aceites y Condimentos'],
  },
  {
    name: 'Carnes y Proteínas',
    children: ['Carnes Rojas y Aves', 'Proteínas Vegetales'],
  },
  { name: 'Limpieza y Hogar', children: ['Limpieza', 'Cuidado del Hogar'] },
  // Catch-all for products discovered via external APIs whose category
  // can't be matched locally (see CategoriesService.resolveByHintOrFallback).
  { name: FALLBACK_CATEGORY_NAME },
];
