



const TYPES = {

    // Controllers
    activityController: Symbol.for('activityController'),
    ruleConfigsController: Symbol.for('ruleConfigsController'),
    activitySubmissionsCotroller: Symbol.for('activitySubmissionsCotroller'),
    ledgerController: Symbol.for('ledgerController'),
    cohortsController: Symbol.for('cohortsController'),

    // Services
    activitySubmissionsService: Symbol.for('activitySubmissionsService'),
    activityService: Symbol.for('activityService'),
    ruleConfigsService: Symbol.for('ruleConfigsService'),
    ledgerService: Symbol.for('ledgerService'),
    cohortsService: Symbol.for('cohortsService'),

    // Repositories
    ruleConfigsRepository: Symbol.for('ruleConfigsRepository'),
    ledgerRepository: Symbol.for('ledgerRepository'),
    activityRepository: Symbol.for('activityRepository'),
    activitySubmissionsRepository: Symbol.for('activitySubmissionsRepository'),
    cohortRepository: Symbol.for('cohortRepository'),

};

export { TYPES as HP_SYSTEM_TYPES };