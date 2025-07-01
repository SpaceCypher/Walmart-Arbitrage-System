import dotenv from 'dotenv';
import faker from 'faker';
import { db } from '../config/database';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { Inventory } from '../models/Inventory';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Configure faker seed for consistent data
faker.seed(42);

const categories = [
  'Electronics', 'Groceries', 'Clothing', 'Home & Garden', 
  'Health & Beauty', 'Sports & Outdoors', 'Automotive', 'Books'
];

const subcategories = {
  Electronics: ['Smartphones', 'Laptops', 'TVs', 'Audio', 'Gaming'],
  Groceries: ['Fresh Produce', 'Dairy', 'Meat', 'Snacks', 'Beverages'],
  Clothing: ['Mens', 'Womens', 'Kids', 'Shoes', 'Accessories'],
  'Home & Garden': ['Furniture', 'Appliances', 'Decor', 'Tools', 'Garden'],
  'Health & Beauty': ['Skincare', 'Makeup', 'Vitamins', 'Personal Care'],
  'Sports & Outdoors': ['Exercise', 'Outdoor Recreation', 'Team Sports'],
  Automotive: ['Parts', 'Accessories', 'Tools', 'Maintenance'],
  Books: ['Fiction', 'Non-Fiction', 'Educational', 'Comics']
};

const brands = [
  'Samsung', 'Apple', 'Sony', 'LG', 'Nike', 'Adidas', 'Toyota', 
  'Ford', 'Microsoft', 'Google', 'Amazon', 'Walmart', 'Target'
];

// US cities for store locations
const usCities = [
  { name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { name: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863 },
];

async function generateProducts(count: number = 200) {
  logger.info(`Generating ${count} products...`);
  const products = [];

  for (let i = 0; i < count; i++) {
    const category = faker.random.arrayElement(categories);
    const subcategory = faker.random.arrayElement(subcategories[category as keyof typeof subcategories]);
    const brand = faker.random.arrayElement(brands);
    
    const baseCost = faker.datatype.number({ min: 5, max: 500, precision: 0.01 });
    const markup = faker.datatype.number({ min: 1.2, max: 3.0, precision: 0.01 });
    const standardRetail = baseCost * markup;

    const product = {
      productId: `PRD-${faker.datatype.number({ min: 10000, max: 99999 })}`,
      name: `${brand} ${faker.commerce.productName()}`,
      category,
      subcategory,
      brand,
      description: faker.commerce.productDescription(),
      attributes: {
        weight: faker.datatype.number({ min: 0.1, max: 50, precision: 0.1 }),
        dimensions: {
          length: faker.datatype.number({ min: 1, max: 100, precision: 0.1 }),
          width: faker.datatype.number({ min: 1, max: 100, precision: 0.1 }),
          height: faker.datatype.number({ min: 1, max: 100, precision: 0.1 }),
        },
        perishable: category === 'Groceries' ? faker.datatype.boolean() : false,
        seasonality: faker.random.arrayElements([
          'spring', 'summer', 'fall', 'winter', 'holiday', 'year-round'
        ], faker.datatype.number({ min: 1, max: 3 })),
        ...(category === 'Groceries' && {
          shelfLife: faker.datatype.number({ min: 1, max: 365 })
        }),
      },
      pricing: {
        baseCost,
        standardRetail,
        marginTargets: {
          minimum: baseCost * 1.1,
          target: baseCost * 1.5,
          premium: baseCost * 2.0,
        },
      },
      substitutes: [], // Will be populated later
      complements: [], // Will be populated later
      tags: faker.random.words(3).split(' '),
      isActive: faker.datatype.boolean() ? true : faker.datatype.number({ min: 0, max: 100 }) > 5, // 95% active
    };

    products.push(product);
  }

  await Product.insertMany(products);
  logger.info(`Generated ${products.length} products`);
  return products;
}

async function generateStores(count: number = 50) {
  logger.info(`Generating ${count} stores...`);
  const stores = [];

  for (let i = 0; i < count; i++) {
    const city = faker.random.arrayElement(usCities);
    // Add some variation to coordinates
    const lat = city.lat + faker.datatype.number({ min: -0.5, max: 0.5, precision: 0.0001 });
    const lng = city.lng + faker.datatype.number({ min: -0.5, max: 0.5, precision: 0.0001 });

    const store = {
      storeId: `STORE-${faker.datatype.number({ min: 1000, max: 9999 })}`,
      name: `Walmart Supercenter ${city.name} #${faker.datatype.number({ min: 100, max: 999 })}`,
      location: {
        type: 'Point',
        coordinates: [lng, lat], // [longitude, latitude]
      },
      address: {
        street: faker.address.streetAddress(),
        city: city.name,
        state: city.state,
        zipCode: faker.address.zipCode(),
        country: 'USA',
      },
      capacity: faker.datatype.number({ min: 10000, max: 100000 }),
      operatingHours: {
        monday: { open: '06:00', close: '23:00' },
        tuesday: { open: '06:00', close: '23:00' },
        wednesday: { open: '06:00', close: '23:00' },
        thursday: { open: '06:00', close: '23:00' },
        friday: { open: '06:00', close: '23:00' },
        saturday: { open: '06:00', close: '23:00' },
        sunday: { open: '06:00', close: '23:00' },
      },
      demographics: {
        population: faker.datatype.number({ min: 50000, max: 500000 }),
        medianIncome: faker.datatype.number({ min: 35000, max: 85000 }),
        ageGroups: {
          '18-24': faker.datatype.number({ min: 8, max: 15 }),
          '25-34': faker.datatype.number({ min: 12, max: 20 }),
          '35-44': faker.datatype.number({ min: 12, max: 18 }),
          '45-54': faker.datatype.number({ min: 13, max: 16 }),
          '55-64': faker.datatype.number({ min: 11, max: 15 }),
          '65+': faker.datatype.number({ min: 12, max: 18 }),
        },
      },
      seasonalPatterns: [
        {
          season: 'spring',
          demandMultiplier: faker.datatype.number({ min: 0.9, max: 1.2, precision: 0.1 }),
          categories: ['Home & Garden', 'Clothing', 'Sports & Outdoors'],
        },
        {
          season: 'summer',
          demandMultiplier: faker.datatype.number({ min: 1.0, max: 1.4, precision: 0.1 }),
          categories: ['Sports & Outdoors', 'Health & Beauty'],
        },
        {
          season: 'fall',
          demandMultiplier: faker.datatype.number({ min: 0.8, max: 1.1, precision: 0.1 }),
          categories: ['Clothing', 'Electronics'],
        },
        {
          season: 'winter',
          demandMultiplier: faker.datatype.number({ min: 0.9, max: 1.3, precision: 0.1 }),
          categories: ['Electronics', 'Clothing'],
        },
        {
          season: 'holiday',
          demandMultiplier: faker.datatype.number({ min: 1.5, max: 2.5, precision: 0.1 }),
          categories: ['Electronics', 'Clothing', 'Books'],
        },
      ],
      transportConnections: [], // Will be populated later
      performanceMetrics: {
        averageDailySales: faker.datatype.number({ min: 50000, max: 200000 }),
        inventoryTurnover: faker.datatype.number({ min: 4, max: 12, precision: 0.1 }),
        customerFootfall: faker.datatype.number({ min: 500, max: 3000 }),
        profitMargin: faker.datatype.number({ min: 5, max: 20, precision: 0.1 }),
      },
      isActive: true,
    };

    stores.push(store);
  }

  await Store.insertMany(stores);
  logger.info(`Generated ${stores.length} stores`);
  return stores;
}

async function generateInventory(products: any[], stores: any[], itemsPerStore: number = 100) {
  logger.info(`Generating inventory for ${stores.length} stores...`);
  const inventory = [];

  for (const store of stores) {
    // Select random products for this store
    const storeProducts = faker.random.arrayElements(products, itemsPerStore);

    for (const product of storeProducts) {
      const maxCapacity = faker.datatype.number({ min: 100, max: 1000 });
      const quantity = faker.datatype.number({ min: 0, max: maxCapacity });
      const reorderPoint = Math.floor(maxCapacity * 0.2); // 20% of capacity

      const inventoryItem = {
        storeId: store.storeId,
        productId: product.productId,
        sku: `${product.productId}-${store.storeId}`,
        quantity,
        reservedQuantity: faker.datatype.number({ min: 0, max: Math.floor(quantity * 0.1) }),
        cost: product.pricing.baseCost,
        retailPrice: product.pricing.standardRetail,
        location: {
          latitude: store.location.coordinates[1],
          longitude: store.location.coordinates[0],
        },
        lastUpdated: faker.date.recent(7), // Within last 7 days
        reorderPoint,
        maxCapacity,
        turnoverRate: faker.datatype.number({ min: 2, max: 15, precision: 0.1 }),
        demandForecast: [
          {
            period: '7-day',
            predictedDemand: faker.datatype.number({ min: 10, max: 100 }),
            confidence: faker.datatype.number({ min: 0.6, max: 0.95, precision: 0.01 }),
            createdAt: new Date(),
          },
          {
            period: '14-day',
            predictedDemand: faker.datatype.number({ min: 20, max: 200 }),
            confidence: faker.datatype.number({ min: 0.5, max: 0.9, precision: 0.01 }),
            createdAt: new Date(),
          },
          {
            period: '30-day',
            predictedDemand: faker.datatype.number({ min: 50, max: 500 }),
            confidence: faker.datatype.number({ min: 0.4, max: 0.85, precision: 0.01 }),
            createdAt: new Date(),
          },
        ],
      };

      inventory.push(inventoryItem);
    }
  }

  // Insert in batches to avoid memory issues
  const batchSize = 1000;
  let inserted = 0;
  
  for (let i = 0; i < inventory.length; i += batchSize) {
    const batch = inventory.slice(i, i + batchSize);
    await Inventory.insertMany(batch);
    inserted += batch.length;
    logger.info(`Inserted ${inserted}/${inventory.length} inventory items`);
  }

  logger.info(`Generated ${inventory.length} inventory items`);
  return inventory;
}

async function generateData() {
  try {
    logger.info('Starting data generation...');

    // Connect to database
    await db.connect();
    logger.info('Connected to database');

    // Clear existing data
    logger.info('Clearing existing data...');
    await Promise.all([
      Product.deleteMany({}),
      Store.deleteMany({}),
      Inventory.deleteMany({}),
    ]);

    // Generate data
    const products = await generateProducts(200);
    const stores = await generateStores(50);
    await generateInventory(products, stores, 100);

    logger.info('Data generation completed successfully!');
    logger.info('Summary:');
    logger.info(`- Products: ${products.length}`);
    logger.info(`- Stores: ${stores.length}`);
    logger.info(`- Inventory items: ${stores.length * 100}`);

  } catch (error) {
    logger.error('Error generating data:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  generateData()
    .then(() => {
      logger.info('Data generation script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Data generation script failed:', error);
      process.exit(1);
    });
}

export { generateData };
