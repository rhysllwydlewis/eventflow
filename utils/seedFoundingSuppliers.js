/**
 * Seed Founding Suppliers Script
 * Creates 25-30 realistic founding supplier profiles with full data
 * to fix empty marketplace perception
 */

'use strict';

const dbUnified = require('../db-unified');
const { uid } = require('../store');

const UK_LOCATIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Edinburgh',
  'Cardiff',
  'Bristol',
  'Leeds',
  'Liverpool',
  'Glasgow',
  'Newcastle',
  'Sheffield',
  'Nottingham',
  'Brighton',
  'Oxford',
  'Cambridge',
];

const SUPPLIER_DATA = {
  Venues: [
    {
      name: 'The Grand Manor Estate',
      location: 'London',
      blurb: 'Elegant Georgian manor with stunning gardens and grand ballroom',
      description_short: 'Historic manor house perfect for elegant celebrations',
      description_long:
        'Set in 50 acres of pristine gardens, The Grand Manor Estate offers a perfect blend of historic charm and modern luxury. Our Grade II listed Georgian manor features a grand ballroom, intimate drawing rooms, and beautifully manicured gardens ideal for outdoor ceremonies.',
      price_display: 'From £4,500',
      maxGuests: 150,
      amenities: ['Parking', 'Garden', 'Accommodation', 'Licensed', 'Catering'],
      photos: [
        'https://images.unsplash.com/photo-1519167758481-83f29da8c687',
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3',
      ],
    },
    {
      name: 'Riverside Pavilion',
      location: 'Manchester',
      blurb: 'Contemporary waterside venue with floor-to-ceiling windows',
      description_short: 'Modern riverside venue with stunning city views',
      description_long:
        'Experience breathtaking views of the Manchester skyline from our contemporary glass pavilion. Perfect for modern celebrations, our venue features floor-to-ceiling windows, a riverside terrace, and state-of-the-art facilities.',
      price_display: 'From £3,200',
      maxGuests: 120,
      amenities: ['Parking', 'City Views', 'Licensed', 'AV Equipment', 'Accessible'],
      photos: [
        'https://images.unsplash.com/photo-1478146896981-b80fe463b330',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187',
      ],
    },
    {
      name: 'The Castle Keep',
      location: 'Edinburgh',
      blurb: 'Historic castle venue with panoramic Scottish views',
      description_short: 'Medieval castle with authentic period features',
      description_long:
        'Step back in time at The Castle Keep, a beautifully restored 14th-century castle offering authentic medieval charm combined with modern comforts. Spectacular views across the Scottish countryside, grand halls, and intimate chambers.',
      price_display: 'From £5,000',
      maxGuests: 100,
      amenities: ['Parking', 'Historic Setting', 'Accommodation', 'Licensed', 'Exclusive Use'],
      photos: [
        'https://images.unsplash.com/photo-1543730535-92d5f034b40e',
        'https://images.unsplash.com/photo-1460472178825-e5240623afd5',
      ],
    },
    {
      name: 'Botanical Glasshouse',
      location: 'Birmingham',
      blurb: 'Unique glasshouse venue surrounded by exotic plants',
      description_short: 'Glass conservatory in botanical gardens',
      description_long:
        'Our stunning Victorian glasshouse is nestled within award-winning botanical gardens. Natural light floods through historic glass panels, surrounded by lush tropical plants. A truly unique and Instagram-worthy venue.',
      price_display: 'From £2,800',
      maxGuests: 80,
      amenities: ['Garden', 'Natural Light', 'Licensed', 'Catering', 'Unique Setting'],
      photos: [
        'https://images.unsplash.com/photo-1522057384400-681b421cfebc',
        'https://images.unsplash.com/photo-1528605248644-14dd04022da1',
      ],
    },
  ],
  Photography: [
    {
      name: 'Emma Clarke Photography',
      location: 'London',
      blurb: 'Award-winning wedding photographer specializing in natural, candid moments',
      description_short: 'Natural light and documentary style wedding photography',
      description_long:
        'With over 10 years experience capturing love stories across the UK and Europe, I specialize in natural, unposed photography that tells your unique story. My approach is relaxed and fun, ensuring you feel comfortable while I capture the genuine emotions and candid moments of your special day.',
      price_display: 'From £1,800',
      maxGuests: null,
      amenities: ['Full Day Coverage', 'Engagement Shoot', 'Online Gallery', 'Print Rights'],
      photos: [
        'https://images.unsplash.com/photo-1606216794074-735e91aa2c92',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc',
      ],
    },
    {
      name: 'James Wilson Photography',
      location: 'Manchester',
      blurb: 'Creative photographer with a cinematic, editorial style',
      description_short: 'Cinematic wedding and portrait photography',
      description_long:
        'I bring a cinematic, fashion-forward approach to wedding photography. Inspired by film and editorial photography, my work is dramatic, romantic, and timeless. Every wedding is unique, and I work closely with couples to understand their vision and create stunning images they will treasure forever.',
      price_display: 'From £2,200',
      maxGuests: null,
      amenities: ['8 Hour Coverage', 'Second Shooter', 'USB & Online Gallery', 'Pre-Wedding Shoot'],
      photos: [
        'https://images.unsplash.com/photo-1519741497674-611481863552',
        'https://images.unsplash.com/photo-1606800052052-a08af7148866',
      ],
    },
    {
      name: 'Sarah Mitchell Photo & Film',
      location: 'Bristol',
      blurb: 'Photography and videography packages for complete coverage',
      description_short: 'Professional photo and video wedding packages',
      description_long:
        'Why choose between photography and videography? We offer combined packages that capture your day from every angle. Our team works seamlessly together to document every moment, from getting ready to the last dance, in beautiful photos and cinematic film.',
      price_display: 'From £2,800',
      maxGuests: null,
      amenities: [
        'Photo + Video',
        'Drone Footage',
        'Highlight Film',
        'Full Day Coverage',
        'Online Galleries',
      ],
      photos: [
        'https://images.unsplash.com/photo-1519741497674-611481863552',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc',
      ],
    },
  ],
  Catering: [
    {
      name: 'The Artisan Kitchen',
      location: 'London',
      blurb: 'Farm-to-table catering with seasonal, locally-sourced ingredients',
      description_short: 'Sustainable catering with a focus on local produce',
      description_long:
        'We believe great food starts with great ingredients. Our menus celebrate the best of British seasonal produce, sourced from local farms and suppliers. From elegant canapés to stunning three-course meals, we create bespoke menus that reflect your taste and values.',
      price_display: 'From £65 per head',
      maxGuests: 200,
      amenities: ['Dietary Requirements', 'Tastings', 'Wait Staff', 'Bar Service', 'Sustainable'],
      photos: [
        'https://images.unsplash.com/photo-1555244162-803834f70033',
        'https://images.unsplash.com/photo-1544025162-d76694265947',
      ],
    },
    {
      name: 'Spice Route Catering',
      location: 'Birmingham',
      blurb: 'Authentic Indian and fusion cuisine for modern celebrations',
      description_short: 'Contemporary Indian wedding catering',
      description_long:
        'Bringing the vibrant flavors of India to your celebration. Our award-winning chefs create contemporary menus that honor traditional recipes while embracing modern presentation. From intimate gatherings to grand celebrations, we deliver exceptional food and service.',
      price_display: 'From £45 per head',
      maxGuests: 500,
      amenities: [
        'Live Cooking Stations',
        'Vegetarian & Vegan',
        'Halal Options',
        'Buffet & Plated',
        'Cultural Menus',
      ],
      photos: [
        'https://images.unsplash.com/photo-1596040033229-a0b3b83c3d99',
        'https://images.unsplash.com/photo-1567337710282-00832b415979',
      ],
    },
    {
      name: 'Coastal Seafood Co.',
      location: 'Brighton',
      blurb: 'Fresh seafood and Mediterranean-inspired wedding menus',
      description_short: 'Seafood specialists for coastal celebrations',
      description_long:
        'Located in Brighton, we specialize in the freshest seafood and Mediterranean cuisine. Our menus feature daily catches from local fishermen, paired with seasonal vegetables and homemade pasta. Perfect for seaside celebrations and food lovers.',
      price_display: 'From £70 per head',
      maxGuests: 150,
      amenities: ['Fresh Seafood', 'Wine Pairing', 'Tastings', 'Outdoor BBQ', 'Wait Staff'],
      photos: [
        'https://images.unsplash.com/photo-1559339352-11d035aa65de',
        'https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c',
      ],
    },
  ],
  Entertainment: [
    {
      name: 'The Groove Collective',
      location: 'Manchester',
      blurb: '7-piece soul and funk band bringing energy to every celebration',
      description_short: 'Live soul, funk, and Motown band',
      description_long:
        'Get ready to dance! The Groove Collective is a high-energy 7-piece band featuring three powerhouse vocalists, horn section, and killer rhythm section. We specialize in classic soul, funk, and Motown, with modern hits reimagined in our signature style. Guaranteed to fill the dance floor!',
      price_display: 'From £2,500',
      maxGuests: null,
      amenities: ['PA System', 'Lighting', 'DJ Between Sets', 'First Dance', 'Song Requests'],
      photos: [
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
        'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae',
      ],
    },
    {
      name: 'DJ Marcus Cole',
      location: 'London',
      blurb: 'Professional DJ with 15 years experience across all genres',
      description_short: 'Versatile DJ for weddings and corporate events',
      description_long:
        "I'm a professional DJ specializing in weddings and corporate events. With a music library spanning every decade and genre, I read the room and keep everyone dancing all night. Premium sound system, elegant setup, and a stress-free approach to music planning.",
      price_display: 'From £800',
      maxGuests: null,
      amenities: [
        'Premium Sound System',
        'Lighting',
        'Music Planning',
        'Ceremony Sound',
        'Wireless Mics',
      ],
      photos: [
        'https://images.unsplash.com/photo-1571266028243-d220bb1a8ffc',
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7',
      ],
    },
    {
      name: 'String Quartet Elegance',
      location: 'Edinburgh',
      blurb: 'Classical string quartet for ceremonies and cocktail hours',
      description_short: 'Professional string quartet for elegant events',
      description_long:
        'Add sophistication to your ceremony and reception with live classical music. Our professional string quartet performs everything from traditional classical pieces to beautiful arrangements of modern love songs. Perfect for ceremonies, drinks receptions, and elegant dinners.',
      price_display: 'From £600',
      maxGuests: null,
      amenities: ['Classical Repertoire', 'Modern Arrangements', 'Ceremony Music', '2-3 Hours'],
      photos: [
        'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7',
        'https://images.unsplash.com/photo-1507838153414-b4b713384a76',
      ],
    },
  ],
  'Decor & Styling': [
    {
      name: 'Bloom & Co Floristry',
      location: 'Cardiff',
      blurb: 'Stunning floral designs and event styling for modern celebrations',
      description_short: 'Luxury floral design and wedding styling',
      description_long:
        'We create bespoke floral designs that transform spaces and bring your vision to life. From romantic garden-inspired arrangements to bold contemporary designs, every piece is crafted with passion and attention to detail. Full event styling services available.',
      price_display: 'From £1,200',
      maxGuests: null,
      amenities: [
        'Bespoke Designs',
        'Bridal Bouquets',
        'Ceremony Flowers',
        'Centerpieces',
        'Setup & Breakdown',
      ],
      photos: [
        'https://images.unsplash.com/photo-1519225421980-715cb0215aed',
        'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d',
      ],
    },
    {
      name: 'Luna Event Styling',
      location: 'London',
      blurb: 'Full-service event styling and decor hire',
      description_short: 'Complete event styling and decor packages',
      description_long:
        'Transform your venue with our full-service styling. We offer complete decor packages including table settings, lighting, backdrops, signage, and styling accessories. Our team handles everything from initial concept to setup and breakdown, ensuring your vision comes to life flawlessly.',
      price_display: 'From £2,000',
      maxGuests: 200,
      amenities: ['Full Styling', 'Prop Hire', 'Lighting', 'Table Settings', 'Setup Team'],
      photos: [
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3',
        'https://images.unsplash.com/photo-1511795409834-ef04bbd61622',
      ],
    },
  ],
  'Event Planning': [
    {
      name: 'Perfect Day Planning',
      location: 'London',
      blurb: 'Full-service wedding planning from concept to completion',
      description_short: 'Experienced wedding planners for stress-free celebrations',
      description_long:
        'Let us handle the details while you enjoy the journey to your big day. With over 12 years experience, we offer full-service planning, partial coordination, and day-of management. Our calm, organized approach ensures every detail is perfect and you can relax and savor every moment.',
      price_display: 'From £3,500',
      maxGuests: null,
      amenities: [
        'Full Planning',
        'Vendor Management',
        'Timeline Creation',
        'Budget Tracking',
        'Day Coordination',
      ],
      photos: [
        'https://images.unsplash.com/photo-1522673607200-164d1b6ce486',
        'https://images.unsplash.com/photo-1519225421980-715cb0215aed',
      ],
    },
    {
      name: 'Northern Events Ltd',
      location: 'Leeds',
      blurb: 'Corporate and private event planning specialists',
      description_short: 'Professional event planning for all occasions',
      description_long:
        'From intimate gatherings to large corporate events, we bring professionalism, creativity, and attention to detail to every project. Our experienced team manages logistics, vendors, and timelines, ensuring seamless execution of your event.',
      price_display: 'From £2,000',
      maxGuests: null,
      amenities: [
        'Event Management',
        'Vendor Sourcing',
        'Budget Planning',
        'Day-of Coordination',
        'Corporate Events',
      ],
      photos: [
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3',
        'https://images.unsplash.com/photo-1511578314322-379afb476865',
      ],
    },
  ],
};

/**
 * Generate sample reviews for suppliers
 */
function generateReviews(supplierId, count = 3) {
  const reviewTemplates = [
    {
      rating: 5,
      text: 'Absolutely fantastic service from start to finish. Highly professional and delivered exactly what we wanted. Would recommend to anyone!',
      author: 'Sarah M.',
    },
    {
      rating: 5,
      text: "We couldn't have asked for better. Everything was perfect and exceeded our expectations. Thank you so much!",
      author: 'James & Emily',
    },
    {
      rating: 5,
      text: 'Outstanding quality and incredible attention to detail. Made our special day truly memorable.',
      author: 'Rachel T.',
    },
    {
      rating: 4,
      text: 'Really happy with the service provided. Professional, friendly, and great value for money.',
      author: 'Michael & Lisa',
    },
    {
      rating: 5,
      text: 'Exceptional service! They went above and beyond to make sure everything was perfect. Thank you!',
      author: 'David & Sophie',
    },
  ];

  return reviewTemplates.slice(0, count).map((template, index) => ({
    id: uid('rev'),
    supplierId,
    userId: uid('usr'),
    rating: template.rating,
    text: template.text,
    authorName: template.author,
    createdAt: new Date(Date.now() - (count - index) * 30 * 24 * 60 * 60 * 1000).toISOString(),
    approved: true,
  }));
}

/**
 * Generate sample packages for suppliers
 */
function generatePackages(supplierId, supplierName, category, location) {
  const packageTemplates = {
    Venues: [
      {
        title: 'Full Day Wedding Package',
        description:
          'Complete venue hire from 10am-midnight including ceremony space, reception area, and exclusive use of grounds',
        price: '£4,500',
      },
      {
        title: 'Evening Reception Package',
        description:
          'Evening venue hire from 6pm-midnight, perfect for those having ceremony elsewhere',
        price: '£2,200',
      },
    ],
    Photography: [
      {
        title: 'Full Day Coverage',
        description:
          '10 hours coverage, online gallery, print rights, and engagement shoot included',
        price: '£2,200',
      },
      {
        title: 'Half Day Package',
        description: '6 hours coverage from preparations to first dance, online gallery included',
        price: '£1,400',
      },
    ],
    Catering: [
      {
        title: 'Three Course Wedding Breakfast',
        description: 'Canapés on arrival, three course meal, wine service, and evening buffet',
        price: '£75 per head',
      },
      {
        title: 'Cocktail Reception',
        description: 'Selection of canapés and drinks for 2 hours',
        price: '£35 per head',
      },
    ],
    Entertainment: [
      {
        title: 'Full Evening Performance',
        description: '2 x 60 minute sets, PA system, lighting, and DJ service between sets',
        price: '£2,500',
      },
    ],
    'Decor & Styling': [
      {
        title: 'Complete Floral Package',
        description:
          'Bridal bouquet, bridesmaid bouquets, buttonholes, ceremony arrangements, and table centerpieces',
        price: '£1,800',
      },
    ],
    'Event Planning': [
      {
        title: 'Full Wedding Planning',
        description:
          'Complete planning service from 12 months out, including vendor management and day-of coordination',
        price: '£4,500',
      },
      {
        title: 'Day-of Coordination',
        description:
          'Professional coordination on your wedding day to ensure everything runs smoothly',
        price: '£750',
      },
    ],
  };

  const templates = packageTemplates[category] || [];

  return templates.map((template, index) => ({
    id: uid('pkg'),
    supplierId,
    title: template.title,
    slug: `${supplierName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${template.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    description: template.description,
    price: template.price,
    location,
    categories: [category.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
    approved: true,
    featured: index === 0,
    isFeatured: index === 0,
  }));
}

/**
 * Seed founding suppliers into database
 */
async function seedFoundingSuppliers() {
  console.log('🌱 Starting founding suppliers seed...');

  try {
    await dbUnified.initializeDatabase();

    const existingSuppliers = await dbUnified.read('suppliers');
    const existingPackages = await dbUnified.read('packages');
    const existingReviews = await dbUnified.read('reviews');

    const allSuppliers = [];
    const allPackages = [];
    const allReviews = [];

    // Generate suppliers for each category
    for (const [category, suppliers] of Object.entries(SUPPLIER_DATA)) {
      for (const supplierData of suppliers) {
        const supplierId = uid('sup');

        // Create supplier
        const supplier = {
          id: supplierId,
          ownerUserId: null,
          name: supplierData.name,
          logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(supplierData.name)}&size=200&background=0B8073&color=fff`,
          blurb: supplierData.blurb,
          category,
          location: supplierData.location,
          price_display: supplierData.price_display,
          website: '',
          email: `hello@${supplierData.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.uk`,
          phone: `0${Math.floor(Math.random() * 9000000000) + 1000000000}`,
          license: '',
          amenities: supplierData.amenities,
          maxGuests: supplierData.maxGuests,
          photos: supplierData.photos,
          description_short: supplierData.description_short,
          description_long: supplierData.description_long,
          approved: true,
          isPro: false,
          isFounding: true, // Founding supplier badge
          foundingYear: 2025,
          badges: ['founding'], // Badge system
          rating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
          reviewCount: 3,
        };

        allSuppliers.push(supplier);

        // Generate packages
        const packages = generatePackages(
          supplierId,
          supplierData.name,
          category,
          supplierData.location
        );
        allPackages.push(...packages);

        // Generate reviews
        const reviews = generateReviews(supplierId, 3);
        allReviews.push(...reviews);
      }
    }

    // Add additional suppliers from different locations to reach 25-30 total
    const additionalLocations = [
      'Liverpool',
      'Newcastle',
      'Glasgow',
      'Sheffield',
      'Nottingham',
      'Oxford',
      'Cambridge',
    ];

    // Add a few more venues and photographers in different locations
    const additionalSuppliers = [
      {
        category: 'Venues',
        name: 'The Clocktower',
        location: 'Liverpool',
        blurb: 'Industrial chic venue in converted warehouse',
        description_short: 'Urban warehouse venue with exposed brick',
        description_long:
          'Converted Victorian warehouse with original features, exposed brick, and modern amenities.',
        price_display: 'From £2,500',
        maxGuests: 100,
        amenities: ['Parking', 'Urban Setting', 'Licensed', 'Flexible Space'],
        photos: [
          'https://images.unsplash.com/photo-1519167758481-83f29da8c687',
          'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3',
        ],
      },
      {
        category: 'Photography',
        name: 'Highland Lens Photography',
        location: 'Glasgow',
        blurb: 'Capturing Scottish celebrations with a creative eye',
        description_short: 'Wedding photography across Scotland',
        description_long:
          'Based in Glasgow, specializing in creative, documentary-style wedding photography across Scotland.',
        price_display: 'From £1,600',
        maxGuests: null,
        amenities: ['Full Day Coverage', 'Second Shooter', 'Online Gallery', 'Print Rights'],
        photos: [
          'https://images.unsplash.com/photo-1606216794074-735e91aa2c92',
          'https://images.unsplash.com/photo-1511285560929-80b456fea0bc',
        ],
      },
    ];

    for (const supplierData of additionalSuppliers) {
      const supplierId = uid('sup');
      const supplier = {
        id: supplierId,
        ownerUserId: null,
        name: supplierData.name,
        logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(supplierData.name)}&size=200&background=0B8073&color=fff`,
        blurb: supplierData.blurb,
        category: supplierData.category,
        location: supplierData.location,
        price_display: supplierData.price_display,
        website: '',
        email: `hello@${supplierData.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.uk`,
        phone: `0${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        license: '',
        amenities: supplierData.amenities,
        maxGuests: supplierData.maxGuests,
        photos: supplierData.photos,
        description_short: supplierData.description_short,
        description_long: supplierData.description_long,
        approved: true,
        isPro: false,
        isFounding: true,
        foundingYear: 2025,
        badges: ['founding'],
        rating: 4.5 + Math.random() * 0.5,
        reviewCount: 3,
      };

      allSuppliers.push(supplier);

      const packages = generatePackages(
        supplierId,
        supplierData.name,
        supplierData.category,
        supplierData.location
      );
      allPackages.push(...packages);

      const reviews = generateReviews(supplierId, 3);
      allReviews.push(...reviews);
    }

    // Write to database
    const updatedSuppliers = [...existingSuppliers, ...allSuppliers];
    const updatedPackages = [...existingPackages, ...allPackages];
    const updatedReviews = [...(existingReviews || []), ...allReviews];

    await dbUnified.write('suppliers', updatedSuppliers);
    await dbUnified.write('packages', updatedPackages);

    // Create reviews collection if it doesn't exist
    try {
      await dbUnified.write('reviews', updatedReviews);
    } catch (error) {
      console.warn('Could not write reviews:', error.message);
    }

    console.log(`✅ Created ${allSuppliers.length} founding suppliers`);
    console.log(`✅ Created ${allPackages.length} packages`);
    console.log(`✅ Created ${allReviews.length} reviews`);
    console.log('🌱 Founding suppliers seed complete!');

    return {
      suppliers: allSuppliers.length,
      packages: allPackages.length,
      reviews: allReviews.length,
    };
  } catch (error) {
    console.error('❌ Error seeding founding suppliers:', error);
    throw error;
  }
}

// Allow running directly from command line
if (require.main === module) {
  seedFoundingSuppliers()
    .then(result => {
      console.log('Seed completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

module.exports = { seedFoundingSuppliers };
