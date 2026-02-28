



const TYPES = {

    // controllers
    activityController: Symbol.for('activityController'),
    ruleConfigsController: Symbol.for('ruleConfigsController'),
    activitySubmissionsCotroller: Symbol.for('activitySubmissionsCotroller'),
    ledgerController: Symbol.for('ledgerController'),

    // services
    activitySubmissionsService: Symbol.for('activitySubmissionsService'),
    activityService: Symbol.for('activityService'),
    ruleConfigsService: Symbol.for('ruleConfigsService'),
    ledgerService: Symbol.for('ledgerService'),

    // repositories
    ruleConfigsRepository: Symbol.for('ruleConfigsRepository'),
    ledgerRepository: Symbol.for('ledgerRepository'),
    activityRepository: Symbol.for('activityRepository'),
    activitySubmissionsRepository: Symbol.for('activitySubmissionsRepository'),

};

export { TYPES as HP_SYSTEM_TYPES };