const mongoose = require("mongoose");

const SectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "Module", required: true },
    sectionItems: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'sectionItems.itemType' },
        itemType: { type: String, required: true, enum: ['Video', 'Assessment'] }  // This field determines which model to reference
    }],
    sequence: { type: Number, required: true }, // Section order within a module
}, { timestamps: true });

const Section = mongoose.model("Section", SectionSchema);
module.exports = Section;
