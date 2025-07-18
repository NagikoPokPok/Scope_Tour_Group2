const { Op } = require('sequelize');
const Team = require('../models/Team');
const TeamMember = require('../models/TeamMember');
const InvitationController = require('./invitation_controller'); // import nếu cần

exports.createTeam = async (req, res) => {
    // try {
    //     const { teamName } = req.body;
    //     if (!teamName) {
    //         return res.status(400).json({ message: 'Team name is required' });
    //     }
    //     const newTeam = await Team.create({ name: teamName });
    //     return res.status(201).json({
    //         message: 'Team created successfully!',
    //         data: newTeam
    //     });
    // } catch (error) {
    //     console.error('Error creating team:', error);
    //     return res.status(500).json({ message: 'Error creating team' });
    // }
    try {
        const { teamName, created_by, emails, host } = req.body;
        if (!teamName || !created_by) {
            return res.status(400).json({ message: 'Team name and created_by are required' });
        }
        const newTeam = await Team.create({ name: teamName, created_by });

        console.log('host:', host);
        // Gửi lời mời cho từng email (nếu có)
        if (Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                // Gọi hàm gửi lời mời (có thể dùng InvitationController hoặc gọi trực tiếp service)
                await InvitationController.sendInvitation({ body: { host, email, team_id: newTeam.team_id, team_name: newTeam.name } }, { json: () => {}, status: () => ({ json: () => {} }) });
                // Hoặc gọi trực tiếp service gửi email nếu muốn đơn giản hơn
            }
        }

        return res.status(201).json({
            message: 'Team created successfully!',
            data: newTeam
        });
    } catch (error) {
        console.error('Error creating team:', error);
        return res.status(500).json({ message: 'Error creating team' });
    }
};

// Fetch teams (all or filtered by search)
// exports.fetchTeams = async (req, res) => {
//     try {
//         const searchQuery = req.query.search || '';
//         const created_by = req.query.created_by;
//         if (!created_by) {
//             return res.status(400).json({ message: 'created_by is required' });
//         }
//         let whereClause = { created_by };
//         if (searchQuery.trim()) {
//             whereClause.name = { [Op.like]: `%${searchQuery.trim()}%` };
//         }
//         const createdTeams = await Team.findAll({ where: whereClause });

//         // 2. Lấy các team mà user là thành viên
//         const memberships = await TeamMember.findAll({
//             where: { user_id: created_by }
//         });

//         const teamIds = memberships.map(tm => tm.team_id);
//         const memberTeams = teamIds.length > 0
//             ? await Team.findAll({
//                 where: {
//                     team_id: {
//                         [Op.in]: teamIds
//                     },
//                     ...(searchQuery.trim() && {
//                         name: { [Op.like]: `%${searchQuery.trim()}%` }
//                     })
//                 }
//               })
//             : [];
//         // 3. Gộp kết quả (tránh trùng lặp nếu user vừa là creator vừa là member)
//         const allTeamsMap = new Map();
//         [...createdTeams, ...memberTeams].forEach(team => {
//             allTeamsMap.set(team.team_id, team);
//         });

//         const teams = Array.from(allTeamsMap.values());
//         // console.log('All teams:', teams); // Debug log
//         // console.log('createdTeams:', createdTeams); // Debug log
//         // console.log('memberTeams:', memberTeams); // Debug log
//         return res.status(200).json({ teams });
//     } catch (error) {
//         console.error('Error fetching teams:', error);
//         return res.status(500).json({ message: 'Error fetching teams' });
//     }
// };

// Fetch teams (all or filtered by search) – hỗ trợ phân trang
exports.fetchTeams = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const created_by = req.query.created_by;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        if (!created_by) {
            return res.status(400).json({ message: 'created_by is required' });
        }

        // Điều kiện WHERE cho search
        let searchNameCondition = {};
        if (searchQuery.trim()) {
            searchNameCondition = { name: { [Op.like]: `%${searchQuery.trim()}%` } }||null;
        }

        // 1. Lấy tối đa 10 team user tạo
        const createdTeams = await Team.findAll({
            where: {
                created_by
                // ...searchNameCondition
            },
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });

        // 2. Lấy tối đa 10 team_id user là member
        const memberships = await TeamMember.findAll({
            where: { 
                user_id: created_by
                // ...searchNameCondition // áp dụng search nếu có
             },
            attributes: ['team_id', 'joined_at'],
            order: [['joined_at', 'DESC']],
            limit,
            offset,
            raw: true
        });
        // const memberTeamIds = memberships.map(m => m.team_id);

        // 3. Lấy chi tiết team từ team_id (và apply search nếu cần)
        // Lấy chi tiết team của memberTeams
        const memberTeamIds = memberships.map(m => m.team_id);
        let memberTeams = [];
        if (memberTeamIds.length > 0) {
            // Lấy cả joined_at từ membership
            const teamMap = {};
            memberships.forEach(m => teamMap[m.team_id] = m.joined_at);
            const teams = await Team.findAll({
                where: { team_id: { [Op.in]: memberTeamIds } }
            });
            memberTeams = teams.map(team => ({
                ...team.get(),
                user_related_time: teamMap[team.team_id] // member: lấy joined_at
            }));
        }

        // 4. Gộp & loại trùng
        const allTeamsMap = new Map();
        createdTeams.forEach(team => {
            allTeamsMap.set(team.team_id, team);
        });
        memberTeams.forEach(team => {
            if (allTeamsMap.has(team.team_id)) {
                // Nếu user vừa là creator vừa là member, lấy thời điểm lớn hơn
                const existing = allTeamsMap.get(team.team_id);
                existing.user_related_time = new Date(existing.user_related_time) > new Date(team.user_related_time)
                    ? existing.user_related_time
                    : team.user_related_time;
                allTeamsMap.set(team.team_id, existing);
            } else {
                allTeamsMap.set(team.team_id, team);
            }
        });
        let teams = Array.from(allTeamsMap.values());

        // 5. Sắp xếp lại theo created_at DESC và lấy 10 team mới nhất
        teams = teams.sort((a, b) => new Date(b.user_related_time) - new Date(a.user_related_time));
        teams = teams.slice(0, 10);

        // 6. Tính tổng
        const createdCount = await Team.count({ where: { created_by } });
        const memberCount = await TeamMember.count({ where: { user_id: created_by } });
        const total = createdCount + memberCount;
        console.log('Total teams:', total); // Debug log

        // 7. Trả về
        return res.status(200).json({
            teams,
            total,
            totalPages: total > limit ? Math.ceil(total / limit) : 1
        });
    } catch (error) {
        console.error('Error fetching teams:', error);
        return res.status(500).json({ message: 'Error fetching teams' });
    }
};

// Delete team function
exports.deleteTeam = async (req, res) => {
    try {
      const { teamId } = req.params;
  
      // Kiểm tra xem team có tồn tại không
      const team = await Team.findByPk(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
  
      // Xoá team (nếu có ràng buộc quan hệ, có thể cần xoá các thành viên trước)
      await Team.destroy({ where: { team_id: teamId } });
  
      return res.status(200).json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("Error deleting team:", error);
      return res.status(500).json({ message: "Error deleting team" });
    }
};

// Update team function
exports.updateTeam = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { teamName } = req.body;

        if (!teamId || !teamName) {
            return res.status(400).json({ message: 'Team ID and name are required' });
        }

        // Find team
        const team = await Team.findByPk(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Update team
        await Team.update({ name: teamName }, { where: { team_id: teamId } });

        return res.status(200).json({ message: 'Team updated successfully' });
    } catch (error) {
        console.error('Error updating team:', error);
        return res.status(500).json({ message: 'Error updating team' });
    }
};

module.exports = exports;