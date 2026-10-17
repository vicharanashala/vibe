import { ISettingRepository } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { ObjectId } from "mongodb";
import { ForbiddenError } from "routing-controllers";
import { COHORT_OVERRIDES } from "../constants.js";

/**
 * The HP System is an opt-in, per-course-version feature: it is on only when
 * `courseSettings.settings.hpSystem` is true for that version.
 *
 * Turning it off never destroys anything — instructors keep read access to the
 * activities, submissions and ledger entries a course already accumulated — but
 * nothing new may be written against a version that has it switched off.
 */
@injectable()
export class HpAccessService {
    /**
     * Versions that predate course settings. They carry HP data but have no
     * `hpSystem` flag to read, so they stay writable until they are migrated.
     */
    private readonly legacyVersionIds = new Set(
        Object.values(COHORT_OVERRIDES).map(o => o.versionId),
    );

    constructor(
        @inject(GLOBAL_TYPES.SettingRepo)
        private readonly settingsRepository: ISettingRepository,
    ) { }

    async isEnabled(courseVersionId?: string | ObjectId | null): Promise<boolean> {
        const versionId = courseVersionId?.toString();
        if (!versionId || !ObjectId.isValid(versionId)) return false;
        if (this.legacyVersionIds.has(versionId)) return true;

        const settings = await this.settingsRepository.getSettingsByVersionIds([
            new ObjectId(versionId),
        ]);

        return (settings ?? []).some(s => s.settings?.hpSystem === true);
    }

    /**
     * Guards every write that creates HP data or moves a student's HP balance.
     * Reads are deliberately left open so existing records stay reachable.
     */
    async assertEnabled(courseVersionId?: string | ObjectId | null): Promise<void> {
        if (await this.isEnabled(courseVersionId)) return;

        throw new ForbiddenError(
            "The HP System is turned off for this course. Existing HP records remain visible, but they can no longer be changed.",
        );
    }
}
