const Section = require('../../models/Course/SectionSchema');
const Video = require('../../models/Course/SectionItems/VideoSchema');
const Assessment = require('../../models/Course/SectionItems/AssesmentSchema');

exports.fetchSectionItemsController = async (req, res) => {
    try {
        const sectionId = req.query.section_id;

        if (!sectionId) {
            return res.status(400).json({ message: "Section ID must be provided." });
        }

        const section = await Section.findById(sectionId).populate({
            path: 'sectionItems.itemId',
            // Automatically select the correct model based on the itemType
        });

        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        const responseData = section.sectionItems.map(item => ({
            id: item.itemId._id,
            title: item.itemId.title,
            description: item.itemId.description || "",  // Description may not be present in all item types
            item_type: item.itemType,
            sequence: item.itemId.sequence,
            source: item.itemType === 'Video' ? item.itemId.url : undefined,  // Only include URL if itemType is 'Video'
            questions: item.itemType === 'Assessment' ? item.itemId.questions : undefined , // Only include questions if itemType is 'Assessment'
            start_time: item.itemType === 'Video' ? item.itemId.startTime : undefined,
            end_time: item.itemType === 'Video' ? item.itemId.endTime : undefined,
        }));

        res.json(responseData);
    } catch (error) {
        console.error("Error fetching section items:", error);
        res.status(500).json({ message: "Error fetching section items" });
    }
};
