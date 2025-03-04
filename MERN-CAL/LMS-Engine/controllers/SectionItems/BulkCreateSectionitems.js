const Section = require('../../models/Course/SectionSchema');
const Video = require('../../models/Course/SectionItems/VideoSchema');
const Question = require('../../models/Course/SectionItems/QuestionSchema');
const Assessment = require('../../models/Course/SectionItems/AssesmentSchema');
const User = require('../../models/User/UserSchema');

exports.bulkUpload = async (req, res) => {
  try {
    const { sectionId, data } = req.body.content;

    const { firebase_id } = req.user;
    const user = await User.findOne({ firebaseUid: firebase_id });
    const createdBy = user._id;
    // Validate Section
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }

    
    console.log("Existing Section Items:", section.sectionItems); // Debugging log

    // **Check if bulk upload has already been done**
    if (section.sectionItems && section.sectionItems.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Bulk upload already completed for this section. You can upload only once." 
      });
    }

    let createdItems = [];

    // Process Videos (Segments)
    if (data[0] && data[0].segments) {
      const videoDocs = await Video.insertMany(
        data[0].segments.map((segment) => ({
          title: segment.title || "Untitled Video",
          description: segment.description || '',
          url: segment.video_url,
          sequence: segment.sequence, // Use provided sequence
          section: sectionId,
          startTime: segment.start_time,
          endTime: segment.end_time
        }))
      );

      // Link Videos to the Section
      const videoItems = videoDocs.map(video => ({
        itemId: video._id,
        itemType: "Video"
      }));

      section.sectionItems.push(...videoItems);
      createdItems.push(...videoDocs);
    }

    const assessmentMap = new Map(); // Store assessments by sequence

    // Process Questions (Create separate assessments for each question)
    if (data[0] && data[0].questions) {
      for (const q of data[0].questions) {
        let assessment;
    
        // Check if an assessment already exists for this sequence
        if (assessmentMap.has(q.sequence)) {
          assessment = assessmentMap.get(q.sequence); // Reuse existing assessment
        } else {
          // Create a new assessment only if it doesn't exist for this sequence
          assessment = new Assessment({
            title: `Assessment: ${q.question}`, 
            section: sectionId,
            sequence: q.sequence,
            questions: [] // Initialize empty questions array
          });
    
          const savedAssessment = await assessment.save();
          assessmentMap.set(q.sequence, savedAssessment); // Store for reuse
          createdItems.push(savedAssessment); // Only push when a new one is created
        }
    
        // Create the question and assign the existing assessment ID
        const question = new Question({
          assessment: assessment._id,
          createdBy: createdBy,
          questionText: q.question,
          type: "multiple-choice",
          options: [q.option_1, q.option_2, q.option_3, q.option_4],
          answer: [q[`option_${parseInt(q.correct_answer) + 1}`]],
          timeLimit: 30,
          points: 5
        });
    
        const savedQuestion = await question.save();
        assessment.questions.push(savedQuestion._id); // Add question to assessment
        await assessment.save();
      }
    }
    
        
    
        // **Now, update the Section with new items (Only if Upload is Successful)**
        if (createdItems.length > 0) {
          await Section.findByIdAndUpdate(sectionId, {
            $push: { sectionItems: createdItems.map(item => ({ itemId: item._id, itemType: item.type || "Unknown" })) }
          });
        }
    
        res.status(201).json({ success: true, message: "Bulk upload successful", data: createdItems });
      } catch (error) {
        console.error("Bulk upload error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    };