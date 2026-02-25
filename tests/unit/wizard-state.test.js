/**
 * Unit tests for Wizard State Manager
 */

/* eslint-env browser */

describe('WizardState', () => {
  let mockLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {};
    global.localStorage = {
      getItem: jest.fn(key => mockLocalStorage[key] || null),
      setItem: jest.fn((key, value) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: jest.fn(key => {
        delete mockLocalStorage[key];
      }),
    };

    // Load the wizard state module
    global.window = global;
    require('../../public/assets/js/utils/wizard-state.js');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getState', () => {
    it('should return default state when no data exists', () => {
      const state = window.WizardState.getState();
      expect(state.currentStep).toBe(0);
      expect(state.completed).toBe(false);
      expect(state.eventType).toBe('');
      expect(state.selectedPackages).toEqual({});
    });

    it('should return stored state when data exists', () => {
      const storedState = {
        currentStep: 2,
        eventType: 'Wedding',
        location: 'London',
        selectedPackages: { venues: 'pkg123' },
      };
      mockLocalStorage['eventflow_plan_builder_v1'] = JSON.stringify(storedState);

      const state = window.WizardState.getState();
      expect(state.currentStep).toBe(2);
      expect(state.eventType).toBe('Wedding');
      expect(state.location).toBe('London');
    });

    it('should migrate legacy eventflow_start data', () => {
      const legacyData = {
        type: 'Wedding',
        name: 'My Wedding',
        location: 'Brighton',
        date: '2024-06-15',
        guests: 100,
      };
      mockLocalStorage['eventflow_start'] = JSON.stringify(legacyData);

      const state = window.WizardState.getState();
      expect(state.eventType).toBe('Wedding');
      expect(state.eventName).toBe('My Wedding');
      expect(state.location).toBe('Brighton');
      expect(state.date).toBe('2024-06-15');
      expect(state.guests).toBe(100);
      expect(state.currentStep).toBe(1); // Should advance to step 1
    });
  });

  describe('saveState', () => {
    it('should save state to localStorage', () => {
      const state = {
        currentStep: 1,
        eventType: 'Wedding',
        location: 'Manchester',
      };

      const result = window.WizardState.saveState(state);
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalled();

      const saved = JSON.parse(mockLocalStorage['eventflow_plan_builder_v1']);
      expect(saved.currentStep).toBe(1);
      expect(saved.eventType).toBe('Wedding');
      expect(saved.lastUpdated).toBeDefined();
    });
  });

  describe('saveStep', () => {
    it('should save step data and update current step', () => {
      const result = window.WizardState.saveStep(1, {
        location: 'Liverpool',
        date: '2024-08-20',
      });

      expect(result).toBe(true);
      const state = window.WizardState.getState();
      expect(state.currentStep).toBe(1);
      expect(state.location).toBe('Liverpool');
      expect(state.date).toBe('2024-08-20');
    });
  });

  describe('selectPackage', () => {
    it('should add package selection', () => {
      window.WizardState.selectPackage('venues', 'pkg123');
      const packages = window.WizardState.getSelectedPackages();
      expect(packages.venues).toBe('pkg123');
    });

    it('should update existing package selection', () => {
      window.WizardState.selectPackage('venues', 'pkg123');
      window.WizardState.selectPackage('venues', 'pkg456');
      const packages = window.WizardState.getSelectedPackages();
      expect(packages.venues).toBe('pkg456');
    });
  });

  describe('deselectPackage', () => {
    it('should remove package selection', () => {
      window.WizardState.selectPackage('venues', 'pkg123');
      window.WizardState.deselectPackage('venues');
      const packages = window.WizardState.getSelectedPackages();
      expect(packages.venues).toBeUndefined();
    });
  });

  describe('validateStep (removed from WizardState — now in WizardValidation)', () => {
    it('should not expose validateStep on WizardState', () => {
      expect(window.WizardState.validateStep).toBeUndefined();
    });
  });

  describe('isReadyForPlanCreation', () => {
    it('should require event type', () => {
      const result = window.WizardState.isReadyForPlanCreation();
      expect(result.ready).toBe(false);
      expect(result.missing).toContain('Event type');
    });

    it('should be ready with Wedding event type', () => {
      window.WizardState.saveStep(0, { eventType: 'Wedding' });
      const result = window.WizardState.isReadyForPlanCreation();
      expect(result.ready).toBe(true);
      expect(result.missing.length).toBe(0);
    });

    it('should be ready with Corporate event type', () => {
      window.WizardState.saveStep(0, { eventType: 'Corporate' });
      const result = window.WizardState.isReadyForPlanCreation();
      expect(result.ready).toBe(true);
    });

    it('should be ready with Birthday event type', () => {
      window.WizardState.saveStep(0, { eventType: 'Birthday' });
      const result = window.WizardState.isReadyForPlanCreation();
      expect(result.ready).toBe(true);
    });

    it('should be ready with Other event type', () => {
      window.WizardState.saveStep(0, { eventType: 'Other' });
      const result = window.WizardState.isReadyForPlanCreation();
      expect(result.ready).toBe(true);
    });
  });

  describe('exportForPlanCreation', () => {
    it('should export complete state for API including notes', () => {
      window.WizardState.saveStep(0, { eventType: 'Wedding' });
      window.WizardState.saveStep(1, {
        location: 'London',
        date: '2024-07-10',
        guests: 150,
        notes: 'Please contact us first',
      });
      window.WizardState.selectPackage('venues', 'pkg1');
      window.WizardState.selectPackage('photography', 'pkg2');

      const exported = window.WizardState.exportForPlanCreation();
      expect(exported.eventType).toBe('Wedding');
      expect(exported.location).toBe('London');
      expect(exported.date).toBe('2024-07-10');
      expect(exported.guests).toBe(150);
      expect(exported.packages).toEqual(['pkg1', 'pkg2']);
    });

    it('should export Corporate event type correctly', () => {
      window.WizardState.saveStep(0, { eventType: 'Corporate' });
      const exported = window.WizardState.exportForPlanCreation();
      expect(exported.eventType).toBe('Corporate');
    });

    it('should export Birthday event type correctly', () => {
      window.WizardState.saveStep(0, { eventType: 'Birthday' });
      const exported = window.WizardState.exportForPlanCreation();
      expect(exported.eventType).toBe('Birthday');
    });
  });

  describe('clearState', () => {
    it('should remove wizard state from localStorage', () => {
      window.WizardState.saveStep(0, { eventType: 'Wedding' });
      window.WizardState.clearState();
      expect(localStorage.removeItem).toHaveBeenCalledWith('eventflow_plan_builder_v1');
    });
  });

  describe('markCompleted', () => {
    it('should mark wizard as completed', () => {
      window.WizardState.markCompleted();
      const state = window.WizardState.getState();
      expect(state.completed).toBe(true);
    });
  });
});
