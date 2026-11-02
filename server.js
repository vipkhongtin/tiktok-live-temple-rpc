const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const STATE_FILE = path.join(DATA_DIR, 'merit-state.json');
const MAX_TTS_CACHE_FILES = 220;

fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

// ============================================================================
// 1. BỘ 18 QUẺ LINH XĂM CHÙA LINH ỨNG (GIẢI NGHĨA ĐA CHỦ ĐỀ: TÀI LỘC, TÌNH DUYÊN, CÔNG DANH, GIA ĐẠO)
// ============================================================================
const FORTUNE_DECK = [
  {
    number: 1,
    rank: 'Thượng Thượng Cát',
    title: 'Nhật Xuất Đông Phương — Mặt Trời Mọc Phương Đông',
    poem: 'Đông phương nhật xuất chiếu Càn Khôn\nHoa nở đầy cành rạng sắc xuân\nCông danh tài lộc đều viên mãn\nGia đạo bình an phúc lộc tồn.',
    meaning: 'Mọi sự mưu cầu đều đại cát đại lợi. Công việc hanh thông, quý nhân phù trợ, gia đình hòa thuận ấm êm.',
    topics: {
      wealth: 'Tài lộc vượng phát như mặt trời mọc, đầu tư kinh doanh thu lợi lớn, quý nhân mang lộc tới tận nhà.',
      love: 'Nhân duyên viên mãn, đôi lứa tâm đầu ý hợp, gia đạo đón hỷ sự viên thành.',
      career: 'Công danh rộng mở, thi cử đỗ cao, thăng quan tiến chức thuận lợi ngoài mong đợi.',
      health: 'Thân tâm an lạc, bệnh tật tiêu trừ, phúc thọ绵 trường.'
    },
    ttsSummary: 'Quẻ số 1, Thượng Thượng Cát, Nhật Xuất Đông Phương. Mọi sự mưu cầu đều đại cát đại lợi, công danh tài lộc viên mãn, quý nhân phù trợ.'
  },
  {
    number: 6,
    rank: 'Thượng Cát',
    title: 'Thiên Quan Tứ Phúc — Trời Ban Phước Lành',
    poem: 'Trời cao ban phước xuống nhân gian\nCửa nhà rạng rỡ ánh hào quang\nLòng thành hướng Phật năng tu thiện\nBốn mùa hưng vượng hưởng bình an.',
    meaning: 'Phước đức tổ tiên và chư Phật gia hộ. Mọi việc khởi sự trong tháng này đều thuận lợi bình an.',
    topics: {
      wealth: 'Lộc tự nhiên đưa tới, buôn may bán đắt, tiền bạc dồi dào.',
      love: 'Tình cảm gắn kết bền chặt, người độc thân sớm gặp良 duyên thiện lành.',
      career: 'Được cấp trên và đồng nghiệp nâng đỡ, bài vở thi cử suôn sẻ.',
      health: 'Sức khỏe dồi dào, tinh thần minh mẫn an vui.'
    },
    ttsSummary: 'Quẻ số 6, Thượng Cát, Thiên Quan Tứ Phúc. Trời ban phước lành, cửa nhà rạng rỡ, bốn mùa hưng vượng bình an.'
  },
  {
    number: 8,
    rank: 'Thượng Cát',
    title: 'Kim Liên Khai Nở — Sen Vàng Tỏa Ngát',
    poem: 'Sen vàng nở rộ giữa hồ trong\nHương thơm lan tỏa khắp non sông\nLòng thành thắp nén nhang cầu nguyện\nTrời Phật chứng tri thỏa ước mong.',
    meaning: 'Tâm thiện lành ắt gặp phước báu. Cầu tài đắc tài, cầu bình an đắc bình an, bệnh tật tiêu trừ.',
    topics: {
      wealth: 'Tài lộc thanh tịnh và bền vững, tích tiểu thành đại, lộc vào như nước.',
      love: 'Tình duyên trong sáng chân thành, gia đình êm ấm thuận hòa.',
      career: 'Nỗ lực thành tâm được đền đáp, học hành đỗ đạt như ý.',
      health: 'Tâm an vạn bệnh tiêu, người lớn tuổi trong nhà trường thọ.'
    },
    ttsSummary: 'Quẻ số 8, Thượng Cát, Kim Liên Khai Nở. Tâm thiện lành ắt gặp phước báu, cầu tài đắc tài, cầu bình an đắc bình an.'
  },
  {
    number: 12,
    rank: 'Đại Cát',
    title: 'Long Vân Tương Hội — Rồng Mây Gặp Gỡ',
    poem: 'Rồng thiêng gặp hội tầng mây xanh\nVượt Vũ Môn Quan rạng rỡ danh\nThí chủ kiên tâm hành thiện đạo\nPhúc dày lộc vượng khắp gia đình.',
    meaning: 'Thời vận đang lên mạnh mẽ. Thi cử đỗ đạt, kinh doanh phát đạt, gặp cơ hội lớn đổi đời.',
    topics: {
      wealth: 'Gặp vận hội lớn về tiền tài, hợp đồng và buôn bán bùng nổ doanh thu.',
      love: 'Hữu duyên thiên lý năng tương ngộ, tình duyên đơm hoa kết trái.',
      career: 'Cá chép hóa rồng vượt Vũ Môn, thi cử đỗ đầu, sự nghiệp thăng tiến vượt bậc.',
      health: 'Sinh khí dồi dào, vượt qua mọi mệt mỏi thử thách.'
    },
    ttsSummary: 'Quẻ số 12, Đại Cát, Long Vân Tương Hội. Thời vận đang lên mạnh mẽ, cá chép hóa rồng, thi cử đỗ đạt, kinh doanh phát đạt.'
  },
  {
    number: 18,
    rank: 'Thượng Cát',
    title: 'Xuân Phong Đắc Ý — Gió Xuân Thuận Buồm',
    poem: 'Thuận buồm xuôi gió vượt trùng khơi\nBến giác bình yên nắng rạng ngời\nTài lộc dồi dào nhân duyên tốt\nBốn mùa hưng thịnh rộn niềm vui.',
    meaning: 'Đi xa gặp may, buôn bán thuận lợi, tình duyên êm đẹp, người thân mạnh khỏe.',
    topics: {
      wealth: 'Thuận buồm xuôi gió, xuất hành cầu tài hay mở rộng kinh doanh đều thắng lợi.',
      love: 'Gió xuân ấm áp, tình cảm đôi lứa ngọt ngào, gia đạo tràn ngập tiếng cười.',
      career: 'Công việc trôi chảy, đi xa học tập hoặc làm việc gặp nhiều may mắn.',
      health: 'Khí huyết lưu thông, cả gia đình bình an khỏe mạnh.'
    },
    ttsSummary: 'Quẻ số 18, Thượng Cát, Xuân Phong Đắc Ý. Thuận buồm xuôi gió, tài lộc dồi dào, nhân duyên tốt đẹp.'
  },
  {
    number: 24,
    rank: 'Trung Cát',
    title: 'Vũ Quá Thiên Thanh — Mưa Tạnh Trời Trong',
    poem: 'Mưa qua trời lại sáng trong ngần\nGian khó lùi xa đón phúc phần\nGiữ vững lòng thành đừng nản chí\nHoa thơm trái ngọt đến mười phân.',
    meaning: 'Khó khăn cũ sắp qua đi, vận may mới đang tới. Hãy kiên nhẫn và giữ tâm bình tĩnh.',
    topics: {
      wealth: 'Giai đoạn chững lại đã qua, dòng tiền và lộc lá đang bắt đầu khởi sắc trở lại.',
      love: 'Mọi hiểu lầm đều được hóa giải, sau cơn mưa trời lại sáng, tình cảm càng thêm sâu đậm.',
      career: 'Kiên trì vượt qua thử thách nhỏ hiện tại sẽ gặt hái thành quả xứng đáng.',
      health: 'Bệnh tình thuyên giảm nhanh chóng, tinh thần phấn chấn trở lại.'
    },
    ttsSummary: 'Quẻ số 24, Trung Cát, Vũ Quá Thiên Thanh. Mưa qua trời lại sáng trong, gian khó lùi xa để đón phúc phần mới.'
  },
  {
    number: 29,
    rank: 'Thượng Cát',
    title: 'Bách Hoa Tề Phóng — Trăm Hoa Đua Nở',
    poem: 'Vườn xuân trăm sắc nở đua hương\nHỷ khí tràn đầy khắp bốn phương\nNhân duyên hòa hợp thêm tài lộc\nMọi bề cát khánh vạn niềm thương.',
    meaning: 'Hỷ sự lâm môn, nhân duyên và giao kết xã hội vô cùng vượng phát.',
    topics: {
      wealth: 'Nhiều nguồn thu cùng nở rộ, khách hàng và đối tác tự tìm đến hợp tác.',
      love: 'Quẻ đại hỷ về tình duyên, dễ có tin vui cưới hỏi hoặc添 đinh thêm phúc.',
      career: 'Tài năng được ghi nhận, gặp môi trường làm việc và đồng nghiệp tuyệt vời.',
      health: 'Tâm hồn thư thái, sắc diện hồng hào tươi trẻ.'
    },
    ttsSummary: 'Quẻ số 29, Thượng Cát, Bách Hoa Tề Phóng. Trăm hoa đua nở, hỷ khí tràn đầy, tình duyên và tài lộc cùng vượng phát.'
  },
  {
    number: 36,
    rank: 'Thượng Thượng Cát',
    title: 'Phúc Tinh Cao Chiếu — Sao Phúc Chiếu Mệnh',
    poem: 'Phúc tinh rực sáng giữa đêm rằm\nTừ bi Phật độ suốt quanh năm\nTài lộc tự nhiên về gõ cửa\nTrăm điều như ý vạn điều lành.',
    meaning: 'Sao Phúc chiếu mạng, tai qua nạn khỏi, tiền tài sung túc, gia đạo hưng long.',
    topics: {
      wealth: 'Sao Phúc và Thần Tài chiếu mệnh, tiền bạc tự nhiên gõ cửa, lộc bất ngờ.',
      love: 'Gia đình đại phúc, trên dưới đồng lòng, tình duyên viên mãn.',
      career: 'Quý nhân quyền quý che chở, mọi kế hoạch lớn đều thành công rực rỡ.',
      health: 'Chư Phật gia hộ tai qua nạn khỏi, bình an vô sự.'
    },
    ttsSummary: 'Quẻ số 36, Thượng Thượng Cát, Phúc Tinh Cao Chiếu. Sao Phúc chiếu mạng, tài lộc tự nhiên gõ cửa, trăm điều như ý.'
  },
  {
    number: 42,
    rank: 'Trung Cát',
    title: 'Tùng Bá Trường Thanh — Tùng Bách Vững Bền',
    poem: 'Tùng xanh đứng vững giữa sương phong\nGốc rễ sâu bền chẳng ngại đông\nChậm chắc từng bước xây cơ nghiệp\nVề sau phú quý hưởng muôn trùng.',
    meaning: 'Lấy sự bền bỉ và chữ Tín làm gốc, cơ nghiệp và phúc đức sẽ vững bền lâu dài.',
    topics: {
      wealth: 'Tích lũy chắc chắn, đầu tư dài hạn sinh lời bền vững, tránh nóng vội.',
      love: 'Tình cảm thủy chung son sắt, bền chặt qua năm tháng.',
      career: 'Nền tảng vững vàng, từng bước khẳng định vị thế vững chắc.',
      health: 'Thể lực dẻo dai bền bỉ, trường thọ an khang.'
    },
    ttsSummary: 'Quẻ số 42, Trung Cát, Tùng Bá Trường Thanh. Kiên định vững bền như cây tùng cây bách, về sau phú quý hưởng muôn trùng.'
  },
  {
    number: 52,
    rank: 'Thượng Cát',
    title: 'Ngọc Xuất Côn Sơn — Ngọc Quý Phát Sáng',
    poem: 'Ngọc quý Côn Sơn tỏa ánh ngời\nBấy lâu rèn giũa nay gặp thời\nTri âm tương ngộ cùng nâng đỡ\nSự nghiệp thăng hoa rạng rỡ đời.',
    meaning: 'Nỗ lực bấy lâu nay sắp được đền đáp xứng đáng. Có người tốt nâng đỡ trong công việc và cuộc sống.',
    topics: {
      wealth: 'Công sức bỏ ra nay kết thành vàng ngọc, thu nhập tăng trưởng xứng đáng.',
      love: 'Gặp được người tri kỷ thấu hiểu và trân trọng giá trị của nhau.',
      career: 'Ngọc sáng lộ diện, thi cử đạt điểm cao, công việc được trọng dụng.',
      health: 'Tinh thần sảng khoái, tràn đầy năng lượng tích cực.'
    },
    ttsSummary: 'Quẻ số 52, Thượng Cát, Ngọc Xuất Côn Sơn. Nỗ lực bấy lâu sắp được đền đáp xứng đáng, sự nghiệp thăng hoa.'
  },
  {
    number: 60,
    rank: 'Đại Cát',
    title: 'Kim Bảng Đề Danh — Bảng Vàng Vinh Hiển',
    poem: 'Mười năm đèn sách chí kiên cường\nMột sớm đề danh khắp bốn phương\nCha mẹ tự hào門 hộ rạng\nCông thành danh toại phúc miên trường.',
    meaning: 'Quẻ đại cát cho học hành, thi cử, xét duyệt hồ sơ và thăng tiến sự nghiệp.',
    topics: {
      wealth: 'Danh tiếng đi đôi với tài lộc, ký kết hợp đồng và dự án thành công.',
      love: 'Gia môn vinh hiển, người thương tự hào và đồng hành vững chắc.',
      career: 'Bảng vàng đề tên! Thi cử đỗ đạt vẻ vang, công danh hiển hách.',
      health: 'Tâm trí sáng suốt, trí nhớ và sức khỏe đều ở trạng thái đỉnh cao.'
    },
    ttsSummary: 'Quẻ số 60, Đại Cát, Kim Bảng Đề Danh. Đại lợi về thi cử học hành và công danh sự nghiệp, bảng vàng vinh hiển.'
  },
  {
    number: 68,
    rank: 'Đại Cát',
    title: 'Lộc Mã Đồng Hương — Lộc Tài Cùng Tới',
    poem: 'Lộc Mã song hành đến tận nhà\nLàm ăn buôn bán nở như hoa\nTâm thành bố thí thêm công đức\nPhú quý vinh hoa khắp một nhà.',
    meaning: 'Quẻ đại lợi về tài lộc và kinh doanh. Nên làm nhiều việc thiện để phúc đức càng thêm bền vững.',
    topics: {
      wealth: 'Lộc Mã song hành, đại cát về buôn bán kinh doanh, tiền tài đổ về bốn hướng.',
      love: 'Gia đình sung túc ấm no, vợ chồng đồng tâm hiệp lực làm giàu.',
      career: 'Thăng tiến nhanh chóng, cơ hội làm ăn lớn liên tiếp mở ra.',
      health: 'Thân khỏe tâm an, gia đạo thịnh vượng.'
    },
    ttsSummary: 'Quẻ số 68, Đại Cát, Lộc Mã Đồng Hương. Đại lợi về tài lộc và buôn bán, phú quý vinh hoa khắp một nhà.'
  },
  {
    number: 72,
    rank: 'Thượng Cát',
    title: 'Từ Hàng Phổ Độ — Thuyền Từ Vượt Bể',
    poem: 'Thuyền từ Bồ Tát vượt trùng dương\nCứu khổ ban vui khắp nẻo đường\nThí chủ giữ tâm lành hướng thiện\nMuôn loài cảm ứng hóa cát tường.',
    meaning: 'Nhờ lòng từ bi và thiện niệm, mọi chướng ngại đều hóa thành duyên lành hộ trì.',
    topics: {
      wealth: 'Xởi lởi trời cho, càng giúp người càng gặp nhiều may mắn về tài chính.',
      love: 'Lấy sự bao dung yêu thương đối đãi, gia đình êm ấm thuận hòa.',
      career: 'Gặp người hiền lương chỉ dẫn, vượt qua mọi sóng gió nhẹ nhàng.',
      health: 'Bồ Tát gia hộ bình an, tai ách tiêu trừ.'
    },
    ttsSummary: 'Quẻ số 72, Thượng Cát, Từ Hàng Phổ Độ. Thuyền từ vượt bể, chư Phật gia hộ biến mọi chướng ngại thành cát tường.'
  },
  {
    number: 79,
    rank: 'Thượng Cát',
    title: 'Phượng Hoàng Lai Nghi — Phượng Hoàng Báo Hỷ',
    poem: 'Phượng hoàng sải cánh đậu ngô đồng\nTin vui đưa tới thỏa chờ trông\nDuyên lành kết trái nhà thêm phúc\nTài lộc hanh thông vạn sự thông.',
    meaning: 'Chim quý báo điềm lành, sắp đón nhận tin vui từ phương xa hoặc hỷ sự trong gia đình.',
    topics: {
      wealth: 'Đón tin vui về tiền bạc hoặc khoản lộc đang chờ đợi bấy lâu.',
      love: 'Phượng hoàng song phi, tình duyên đôi lứa viên mãn, sớm có tin hỷ.',
      career: 'Nhận được tin báo đỗ đạt, trúng tuyển hoặc thăng chức.',
      health: 'Gia đình đón thêm sinh khí mới, mọi người mạnh khỏe an vui.'
    },
    ttsSummary: 'Quẻ số 79, Thượng Cát, Phượng Hoàng Lai Nghi. Chim quý báo tin vui, nhân duyên và tài lộc đều thỏa lòng mong đợi.'
  },
  {
    number: 81,
    rank: 'Thượng Cát',
    title: 'Nguyệt Nhập Trung Thiên — Trăng Rằm Giữa Đỉnh',
    poem: 'Trăng tròn vằng vặc giữa trời thu\nSoi sáng muôn phương sạch mây mù\nTình duyên viên mãn gia đình thuận\nTâm an vạn sự chẳng ưu tư.',
    meaning: 'Tình duyên và gia đạo vô cùng tốt đẹp. Người độc thân dễ gặp ý trung nhân, gia đình thêm tin vui.',
    topics: {
      wealth: 'Tài lộc tròn đầy viên mãn như trăng rằm tháng tám.',
      love: 'Trăng tròn biểu trưng cho đoàn viên và tình yêu trọn vẹn, cực tốt cho cầu duyên.',
      career: 'Mọi kế hoạch đang đi vào giai đoạn thu hoạch viên mãn nhất.',
      health: 'Tâm thanh tịnh sáng trong, giấc ngủ an lành.'
    },
    ttsSummary: 'Quẻ số 81, Thượng Cát, Nguyệt Nhập Trung Thiên. Tình duyên viên mãn, gia đình hòa thuận, tâm an vạn sự lành.'
  },
  {
    number: 88,
    rank: 'Đại Cát',
    title: 'Bát Phương Tiến Bảo — Tám Hướng Đưa Lộc',
    poem: 'Tám phương hội tụ ánh kim ngân\nPhước báu dồi dào bởi thiện nhân\nKinh doanh mở lối thêm hưng vượng\nGia môn phú quý rạng mười phân.',
    meaning: 'Tài lộc từ tám hướng hội tụ, rất hợp cho người cầu tài, mở hàng, kinh doanh buôn bán.',
    topics: {
      wealth: 'Đại phát tài lộc! Tám hướng hội tụ kim ngân, buôn bán một vốn bốn lời.',
      love: 'Gia đình sung túc, tình cảm ấm nồng viên mãn.',
      career: 'Mở rộng quy mô công việc và quan hệ hợp tác đều đại thắng.',
      health: 'Khỏe mạnh sung sức, tinh thần phấn khởi.'
    },
    ttsSummary: 'Quẻ số 88, Đại Cát, Bát Phương Tiến Bảo. Tám hướng hội tụ tài lộc, kinh doanh hưng vượng, phú quý cát tường.'
  },
  {
    number: 95,
    rank: 'Thượng Thượng Cát',
    title: 'Cửu Ngũ Chí Tôn — Vận Hội Đỉnh Cao',
    poem: 'Rồng bay chín tầng đỉnh thái hòa\nUy danh phúc lộc sáng gần xa\nTâm chính chí cao trời đất hộ\nMuôn việc thành tựu rạng sơn hà.',
    meaning: 'Vận khí đang ở đỉnh cao rực rỡ nhất. Hãy giữ tâm khiêm cung và làm việc thiện để giữ vững đại phúc.',
    topics: {
      wealth: 'Tài vận đỉnh cao, thu hoạch lớn từ những dự án tâm huyết.',
      love: 'Gia đạo hưng thịnh, con cháu hiếu thảo thành đạt.',
      career: 'Đạt vị trí dẫn đầu, thi cử hay công danh đều vang dội.',
      health: 'Khí phách tráng kiện, trường thọ khang ninh.'
    },
    ttsSummary: 'Quẻ số 95, Thượng Thượng Cát, Cửu Ngũ Chí Tôn. Vận hội đỉnh cao, muôn việc thành tựu rực rỡ.'
  },
  {
    number: 99,
    rank: 'Thượng Thượng Cát',
    title: 'Vạn Sự Viên Thành — Cửu Cửu Đại Cát',
    poem: 'Chín tầng mây trắng ánh hào quang\nTừ bi Phật Tổ độ nhân gian\nThí chủ lòng thành dâng lễ bái\nTrọn đời trường thọ hưởng vinh khang.',
    meaning: 'Quẻ tối thượng cát tường. Sức khỏe trường thọ, công danh hiển đạt, vạn sự viên thành.',
    topics: {
      wealth: 'Phúc lộc song toàn, giàu sang phú quý bền vững.',
      love: 'Bách niên giai lão, gia đình đại đoàn viên hạnh phúc.',
      career: 'Mọi ước nguyện về học vấn và sự nghiệp đều thành tựu trọn vẹn.',
      health: 'Trường thọ bách tuế, thân tâm thường an lạc.'
    },
    ttsSummary: 'Quẻ số 99, Thượng Thượng Cát, Vạn Sự Viên Thành. Quẻ tối thượng cát tường, sức khỏe trường thọ, vạn sự như ý.'
  }
];

function detectFortuneTopic(rawTopic) {
  const s = String(rawTopic || '').toLowerCase();
  if (/tình duyên|người yêu|vợ chồng|hôn nhân|cưới|duyên|crush|gia đình|con cái/.test(s)) {
    return { key: 'love', label: 'Nhân Duyên & Gia Đạo' };
  }
  if (/thi cử|học hành|đỗ đạt|điểm cao|công việc|sự nghiệp|thăng tiến|xin việc|công danh/.test(s)) {
    return { key: 'career', label: 'Công Danh & Khoa Bảng' };
  }
  if (/sức khỏe|bệnh|bình an|bố mẹ|cha mẹ|ông bà|trường thọ|tai qua/.test(s)) {
    return { key: 'health', label: 'Sức Khỏe & Bình An' };
  }
  if (/tài lộc|tiền|buôn bán|kinh doanh|làm ăn|mở hàng|giàu|lộc/.test(s)) {
    return { key: 'wealth', label: 'Tài Lộc & Kinh Doanh' };
  }
  return { key: 'general', label: 'Tổng Quát & Bình An' };
}

function getMeritTitle(merit) {
  const m = Number(merit) || 0;
  if (m >= 5000) return 'Đại Thí Chủ Bồ Đề';
  if (m >= 1500) return 'Hộ Pháp Kim Cang';
  if (m >= 500) return 'Thiện Tri Thức';
  if (m >= 150) return 'Cư Sĩ Tâm Thành';
  return 'Phật Tử Hữu Duyên';
}

function pruneTtsCacheDir() {
  try {
    const entries = fs
      .readdirSync(TTS_CACHE_DIR)
      .filter((f) => f.endsWith('.wav') || f.endsWith('.mp3'))
      .map((f) => {
        const full = path.join(TTS_CACHE_DIR, f);
        const stat = fs.statSync(full);
        return { full, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    for (const old of entries.slice(MAX_TTS_CACHE_FILES)) {
      try {
        fs.unlinkSync(old.full);
      } catch (_) {}
    }
  } catch (_) {}
}

// ============================================================================
// 2. MULTI-TIER TTS MANAGER (TIER 1: ZEROTTS PYTHON -> TIER 2: CLOUD VI TTS -> TIER 3: WEB SPEECH)
// ============================================================================
class ZeroTTSManager {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.cloudFallbackActive = false;
    this.status = 'starting';
    this.voice = 'hoaimy';
    this.voices = ['hoaimy', 'namminh', 'maichi', 'google_vi'];
    this.model = 'Microsoft Edge Neural (vi-VN) + ZeroTTS';
    this.pending = new Map();
    this.inflight = new Map();
    this.reqCounter = 0;
    this.buffer = '';
    this.restartAttempts = 0;
    this.fatalWorkerError = false;
    this.startWorker();
  }

  resolvePythonBin() {
    const candidates = [
      path.join(__dirname, '.venv', 'Scripts', 'python.exe'),
      path.join(__dirname, '.venv', 'bin', 'python'),
      process.env.PYTHON_BIN
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  enableCloudFallback(reason) {
    this.ready = false;
    this.cloudFallbackActive = true;
    this.status = 'cloud-fallback';
    console.log(`[TTS Engine] Chuyển sang Cloud Vietnamese TTS (Lý do: ${reason})`);
    broadcastNotification('tts.status', this.getStatus());
  }

  startWorker() {
    const pyBin = this.resolvePythonBin();
    const scriptPath = path.join(__dirname, 'tts_worker.py');
    console.log(`[ZeroTTS] Khởi chạy worker với "${pyBin}" (Giọng mặc định: Mai Chi)...`);

    this.status = 'loading';
    try {
      this.proc = spawn(pyBin, [scriptPath], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
    } catch (spawnErr) {
      this.enableCloudFallback(spawnErr.message);
      return;
    }

    this.proc.on('error', (err) => {
      console.warn(`[ZeroTTS] Không thể chạy tiến trình Python (${err.message}). Tự động dùng Cloud TTS Tiếng Việt.`);
      this.fatalWorkerError = true;
      this.enableCloudFallback(err.message);
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleWorkerLine(line.trim());
      }
    });

    this.proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) console.log(`[ZeroTTS stderr] ${msg}`);
    });

    this.proc.on('exit', (code) => {
      for (const [, item] of this.pending) {
        clearTimeout(item.timer);
        item.resolve({ ok: false, error: 'ZeroTTS worker exited' });
      }
      this.pending.clear();

      if (this.fatalWorkerError || code === 1) {
        this.enableCloudFallback(`Worker thoát với mã ${code}`);
        return;
      }

      console.warn(`[ZeroTTS] Worker thoát (code=${code}).`);
      this.ready = false;
      if (this.restartAttempts < 2) {
        this.restartAttempts += 1;
        setTimeout(() => this.startWorker(), 3000);
      } else {
        this.enableCloudFallback('Worker dừng hoạt động');
      }
    });
  }

  handleWorkerLine(line) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'status') {
        this.status = msg.status;
        this.model = msg.model || this.model;
        broadcastNotification('tts.status', this.getStatus());
      } else if (msg.type === 'ready') {
        this.ready = true;
        this.cloudFallbackActive = false;
        this.restartAttempts = 0;
        this.status = 'ready';
        this.voice = msg.voice || 'maichi';
        this.voices = msg.voices || ['maichi'];
        this.model = msg.model || this.model;
        console.log(`[ZeroTTS] Sẵn sàng sau ${msg.loadSec}s! Giọng: ${this.voice} (${this.voices.join(', ')})`);
        broadcastNotification('tts.status', this.getStatus());
      } else if (msg.type === 'result' && msg.id != null) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(msg.id);
          entry.resolve(msg);
        }
      } else if (msg.type === 'error') {
        if (msg.fatal) {
          this.fatalWorkerError = true;
          this.enableCloudFallback(msg.error || 'ZeroTTS chưa được cài đặt');
        } else {
          console.error('[ZeroTTS Error]', msg.error);
          this.status = 'error';
          broadcastNotification('tts.status', this.getStatus());
        }
      }
    } catch (_) {
      console.log('[ZeroTTS stdout]', line);
    }
  }

  getStatus() {
    const activeVoice = state.settings.ttsVoice || this.voice || 'hoaimy';
    return {
      ready: this.ready || this.cloudFallbackActive,
      status: this.status,
      engine:
        activeVoice === 'google_vi'
          ? 'Google Cloud Vietnamese TTS'
          : this.ready
          ? 'Multi-Voice Neural TTS (Edge Neural + ZeroTTS)'
          : 'Cloud Vietnamese Neural TTS (Auto-Fallback)',
      voice: activeVoice,
      voices: this.voices,
      model: this.ready ? this.model : 'vi-VN-Cloud-Standard'
    };
  }

  async synthesizeCloudFallback(cleanText, voice = 'maichi') {
    const normalized = sanitizeWishText(cleanText) || cleanText.slice(0, 180);
    if (!normalized) {
      return { ok: false, error: 'Empty text after sanitization' };
    }
    const hash = crypto.createHash('sha1').update(`cloud_vi_v1::${normalized}`).digest('hex').slice(0, 20);
    const outName = `cloud_${voice}_${hash}.mp3`;
    const outPath = path.join(TTS_CACHE_DIR, outName);

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 200) {
      return {
        ok: true,
        cached: true,
        engine: 'cloud-vi',
        voice,
        file: outName,
        url: `/tts-cache/${outName}`,
        synthSec: 0
      };
    }

    try {
      const t0 = Date.now();
      const q = encodeURIComponent(normalized.slice(0, 195));
      const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${q}`;
      const resp = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const arrayBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.length < 200) {
        throw new Error('Audio buffer too small');
      }
      await fs.promises.writeFile(outPath, buf);
      pruneTtsCacheDir();
      return {
        ok: true,
        cached: false,
        engine: 'cloud-vi',
        voice,
        file: outName,
        url: `/tts-cache/${outName}`,
        synthSec: +((Date.now() - t0) / 1000).toFixed(2)
      };
    } catch (err) {
      return {
        ok: false,
        useBrowserSpeech: true,
        text: normalized,
        error: `Cloud TTS error: ${err.message}`
      };
    }
  }

  synthesize(text, voiceOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text' });
    const voice = (voiceOverride || state.settings.ttsVoice || 'hoaimy').toLowerCase();
    const dedupKey = `${voice}::${cleanText}`;

    if (this.inflight.has(dedupKey)) {
      return this.inflight.get(dedupKey);
    }

    const promise = new Promise((resolve) => {
      if (voice === 'google_vi' || !this.proc || !this.ready) {
        this.synthesizeCloudFallback(cleanText, voice).then(resolve);
        return;
      }
      const id = ++this.reqCounter;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.synthesizeCloudFallback(cleanText, voice).then(resolve);
      }, 15000);

      this.pending.set(id, {
        resolve: (res) => {
          if (res && res.ok) {
            resolve(res);
          } else {
            this.synthesizeCloudFallback(cleanText, voice).then(resolve);
          }
        },
        timer
      });
      const payload = JSON.stringify({ id, text: cleanText, voice }) + '\n';
      try {
        this.proc.stdin.write(payload);
      } catch (_) {
        clearTimeout(timer);
        this.pending.delete(id);
        this.synthesizeCloudFallback(cleanText, voice).then(resolve);
      }
    }).finally(() => {
      this.inflight.delete(dedupKey);
    });

    this.inflight.set(dedupKey, promise);
    return promise;
  }
}

// ============================================================================
// 3. TRẠNG THÁI CHÙA ONLINE, MỤC TIÊU ĐẠI LỄ CỘNG ĐỒNG & BẢNG VÀNG CÔNG ĐỨC
// ============================================================================
const COMMUNITY_GOAL_STEP = 1000;

const DEFAULT_STATE = {
  totalIncense: 108,
  totalMerit: 1080,
  woodenFishHits: 360,
  bellRings: 36,
  lanternCount: 18,
  fortuneCount: 12,
  activeIncenseSticks: 9,
  haloIntensity: 0.45,
  offerings: {
    lotus: 3,
    fruit: 2,
    lamp: 2,
    dragon: 1
  },
  devotees: {},
  recentEvents: [],
  settings: {
    ttsEnabled: true,
    ttsVoice: 'hoaimy',
    bgMusicEnabled: true,
    bgMusicMode: 'auto',
    youtubeUrl: '',
    sfxEnabled: true,
    musicVolume: 0.65,
    ttsVolume: 0.95,
    smokeDensity: 1.0,
    autoSim: false,
    autoSimIntervalMs: 9500
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: 'zenfacts_vn',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_STATE,
        ...saved,
        devotees: saved.devotees || {},
        offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
        tiktok: { ...DEFAULT_STATE.tiktok }
      };
    }
  } catch (e) {
    console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = loadState();
let meritMultiplierUntil = 0; // Timestamp khi đang mở Đại Lễ nhân đôi Công Đức

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSave = {
      totalIncense: state.totalIncense,
      totalMerit: state.totalMerit,
      woodenFishHits: state.woodenFishHits,
      bellRings: state.bellRings,
      lanternCount: state.lanternCount,
      fortuneCount: state.fortuneCount,
      activeIncenseSticks: state.activeIncenseSticks,
      offerings: state.offerings,
      devotees: state.devotees,
      settings: state.settings
    };
    fs.promises.writeFile(STATE_FILE, JSON.stringify(toSave, null, 2), 'utf8').catch((e) => {
      console.error('[State] Lỗi lưu file:', e.message);
    });
  }, 1200);
}

function getLeaderboard(limit = 6) {
  return Object.values(state.devotees)
    .sort((a, b) => b.merit - a.merit)
    .slice(0, limit)
    .map((d, index) => ({
      rank: index + 1,
      name: d.name,
      uniqueId: d.uniqueId,
      avatar: d.avatar || '',
      merit: d.merit,
      title: getMeritTitle(d.merit),
      incense: d.incense || 0,
      lastWish: d.lastWish || ''
    }));
}

// Bộ lọc chặn ký tự lạ (Cuneiform 𒐫, Zalgo, Braille, ký tự spam) & từ ngữ phản cảm
const WEIRD_SPAM_RE = /[\u{12000}-\u{1254F}\uFDFD\u2800-\u28FF\u2580-\u259F]|[\u0300-\u036F]{3,}/u;
const BRACKET_EMOTE_RE = /\[[^\]]{1,24}\]/g;
const ALLOWED_VI_TEXT_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s.,!?]/g;
const ALLOWED_VI_NAME_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s._-]/g;
const VI_LETTER_RE = /[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/g;
const BAD_WORDS_RE = /(đá dái|địt|lồn|cặc|đm|vcl|vl|yamate|i cư|lừa đảo|lừa à|te-le gram|telegram|bố là trùm)/i;

function isBlockedSpamOrToxic(raw) {
  if (!raw) return true;
  const s = String(raw);
  if (WEIRD_SPAM_RE.test(s)) return true;
  if (BAD_WORDS_RE.test(s)) return true;
  return false;
}

function sanitizeUserName(rawName, fallbackSuffix = '') {
  const normalized = String(rawName || '')
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_NAME_RE, ' ')
    .replace(/(.)\1{3,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 26);

  if (!normalized || BAD_WORDS_RE.test(normalized)) {
    return fallbackSuffix ? `Thí Chủ ${fallbackSuffix}` : 'Thí Chủ Hữu Duyên';
  }
  const letters = normalized.match(VI_LETTER_RE) || [];
  if (letters.length < 2) {
    return fallbackSuffix ? `Thí Chủ ${fallbackSuffix}` : 'Thí Chủ Hữu Duyên';
  }
  return normalized;
}

function sanitizeWishText(rawWish) {
  if (!rawWish) return '';
  const cleaned = String(rawWish)
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_TEXT_RE, ' ')
    .replace(/([.,!?])\1+/g, '$1')
    .replace(/(.)\1{2,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?\s-]+|[.,!?\s-]+$/g, '')
    .slice(0, 140);

  if (!cleaned || BAD_WORDS_RE.test(cleaned)) return '';
  const letters = cleaned.match(VI_LETTER_RE) || [];
  if (letters.length < 2) return '';
  return cleaned;
}

function recordDevotee(user, uniqueId, avatar, baseMeritDelta, incenseDelta = 0, giftDelta = 0, wish = '') {
  const cleanId = String(uniqueId || '').trim();
  const suffix = cleanId ? cleanId.slice(-4) : '';
  const displayName = sanitizeUserName(user || cleanId, suffix);
  const cleanWish = sanitizeWishText(wish);

  // Chống gộp nhầm nhiều người lạ vào chung key 'Thí Chủ Hữu Duyên'
  const rawHash = crypto
    .createHash('md5')
    .update(String(cleanId || user || 'anon'))
    .digest('hex')
    .slice(0, 6);
  const key = (cleanId || `${displayName}_${rawHash}`).slice(0, 44);

  if (!state.devotees[key]) {
    state.devotees[key] = {
      name: displayName,
      uniqueId: cleanId || key.toLowerCase().replace(/\s+/g, '_'),
      avatar: avatar || '',
      merit: 0,
      incense: 0,
      gifts: 0,
      lastWish: ''
    };
  }

  const isBonusActive = Date.now() < meritMultiplierUntil;
  const finalMeritDelta = isBonusActive ? baseMeritDelta * 2 : baseMeritDelta;

  const dev = state.devotees[key];
  dev.name = displayName;
  if (avatar) dev.avatar = avatar;
  dev.merit += finalMeritDelta;
  dev.incense += incenseDelta;
  dev.gifts += giftDelta;
  if (cleanWish) dev.lastWish = cleanWish;

  const prevCycle = Math.floor(state.totalMerit / COMMUNITY_GOAL_STEP);
  state.totalMerit += finalMeritDelta;
  const newCycle = Math.floor(state.totalMerit / COMMUNITY_GOAL_STEP);

  // Nếu vừa vượt qua cột mốc 1,000 Điểm Công Đức cộng đồng -> Kích hoạt Pháp Vũ Cam Lồ (x2 Công Đức trong 45s)
  let triggeredCommunityGoal = false;
  if (newCycle > prevCycle && finalMeritDelta > 0) {
    meritMultiplierUntil = Date.now() + 45000;
    triggeredCommunityGoal = true;
  }

  state.haloIntensity = +(0.35 + ((state.totalMerit % COMMUNITY_GOAL_STEP) / COMMUNITY_GOAL_STEP) * 0.65).toFixed(2);
  return {
    devotee: dev,
    finalMeritDelta,
    isBonusActive,
    triggeredCommunityGoal
  };
}

function pushEventLog(evt) {
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...evt
  };
  state.recentEvents.unshift(entry);
  if (state.recentEvents.length > 35) {
    state.recentEvents.length = 35;
  }
  return entry;
}

function getCommunityGoalState() {
  const current = state.totalMerit % COMMUNITY_GOAL_STEP;
  const bonusRemainingSec = Math.max(0, Math.ceil((meritMultiplierUntil - Date.now()) / 1000));
  return {
    current,
    target: COMMUNITY_GOAL_STEP,
    percent: Math.min(100, Math.round((current / COMMUNITY_GOAL_STEP) * 100)),
    level: Math.floor(state.totalMerit / COMMUNITY_GOAL_STEP) + 1,
    bonusActive: bonusRemainingSec > 0,
    bonusRemainingSec
  };
}

function getPublicState() {
  return {
    totalIncense: state.totalIncense,
    totalMerit: state.totalMerit,
    woodenFishHits: state.woodenFishHits,
    bellRings: state.bellRings,
    lanternCount: state.lanternCount,
    fortuneCount: state.fortuneCount,
    activeIncenseSticks: state.activeIncenseSticks,
    haloIntensity: state.haloIntensity,
    communityGoal: getCommunityGoalState(),
    offerings: state.offerings,
    leaderboard: getLeaderboard(24),
    recentEvents: state.recentEvents.slice(0, 15),
    settings: state.settings,
    tiktok: state.tiktok,
    tts: zeroTts ? zeroTts.getStatus() : { ready: false, status: 'init', voice: 'maichi' }
  };
}

// ============================================================================
// 4. NGHI THỨC TƯƠNG TÁC (RITUAL HANDLERS)
// ============================================================================
const Rituals = {
  burnIncense(params = {}) {
    const user = sanitizeUserName(params.user, params.uniqueId);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 3));
    const wish = sanitizeWishText(params.wish) || 'Thành tâm dâng hương bái Phật, cầu bình an cát tường';
    const baseMerit = count * 5;

    state.totalIncense += count;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + count);
    const { devotee, finalMeritDelta, triggeredCommunityGoal } = recordDevotee(
      user,
      uniqueId,
      avatar,
      baseMerit,
      count,
      0,
      wish
    );

    const ttsText =
      params.readTts === false
        ? ''
        : `Nam mô A Di Đà Phật. Cảm tạ thí chủ ${devotee.name} đã thành tâm thắp ${count} nén hương thơm. ${wish}.`;

    const event = pushEventLog({
      type: 'burnIncense',
      priority: params.manual ? 10 : 2,
      manual: Boolean(params.manual),
      user: devotee.name,
      title: getMeritTitle(devotee.merit),
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit: finalMeritDelta,
      triggeredCommunityGoal,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'hoaimy'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user, params.uniqueId);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(50, Number(params.count) || 1));
    const baseMerit = count;

    state.woodenFishHits += count;
    const { devotee, finalMeritDelta, triggeredCommunityGoal } = recordDevotee(
      user,
      uniqueId,
      avatar,
      baseMerit,
      0,
      0
    );

    const event = pushEventLog({
      type: 'strikeWoodenFish',
      priority: params.manual ? 10 : 1,
      manual: Boolean(params.manual),
      user: devotee.name,
      title: getMeritTitle(devotee.merit),
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit: finalMeritDelta,
      triggeredCommunityGoal,
      ttsText: params.ttsText || ''
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  ringBell(params = {}) {
    const user = sanitizeUserName(params.user, params.uniqueId);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish = sanitizeWishText(params.wish) || 'Thỉnh chuông Bát Nhã, phiền não tiêu tan, trí tuệ sáng ngời';
    const baseMerit = count * 10;

    state.bellRings += count;
    const { devotee, finalMeritDelta, triggeredCommunityGoal } = recordDevotee(
      user,
      uniqueId,
      avatar,
      baseMerit,
      0,
      0,
      wish
    );

    const ttsText = params.readTts
      ? `Thí chủ ${devotee.name} thỉnh Đại Hồng Chung cầu nguyện: ${wish}.`
      : '';

    const event = pushEventLog({
      type: 'ringBell',
      priority: params.manual ? 10 : 2,
      manual: Boolean(params.manual),
      user: devotee.name,
      title: getMeritTitle(devotee.merit),
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit: finalMeritDelta,
      triggeredCommunityGoal,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'hoaimy'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  sendPrayer(params = {}) {
    const user = sanitizeUserName(params.user, params.uniqueId);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Cầu cho quốc thái dân an, gia đình mạnh khỏe hạnh phúc';
    const baseMerit = 10;

    state.lanternCount += 1;
    const { devotee, finalMeritDelta, triggeredCommunityGoal } = recordDevotee(
      user,
      uniqueId,
      avatar,
      baseMerit,
      1,
      0,
      wish
    );

    const ttsText =
      params.readTts === false
        ? ''
        : `Lời cầu nguyện của thí chủ ${devotee.name}: ${wish}. Nam mô A Di Đà Phật.`;

    const event = pushEventLog({
      type: 'sendPrayer',
      priority: params.manual ? 10 : 2,
      manual: Boolean(params.manual),
      user: devotee.name,
      title: getMeritTitle(devotee.merit),
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit: finalMeritDelta,
      triggeredCommunityGoal,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'hoaimy'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  offerGift(params = {}) {
    const user = sanitizeUserName(params.user, params.uniqueId);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const coins = Math.max(1, Number(params.coins) || 10);
    const giftType = ['lotus', 'fruit', 'lamp', 'dragon'].includes(params.giftType)
      ? params.giftType
      : coins >= 100
      ? 'dragon'
      : coins >= 20
      ? 'fruit'
      : coins >= 5
      ? 'lamp'
      : 'lotus';

    const giftLabels = {
      lotus: 'Đài Hoa Sen Vàng',
      fruit: 'Mâm Ngũ Quả Cát Tường',
      lamp: 'Đèn Lưu Ly Trí Tuệ',
      dragon: 'Đại Lễ Kim Long Chầu Phật'
    };
    const giftName = params.giftName || giftLabels[giftType];
    const multiplier = coins >= 100 ? 50 : coins >= 10 ? 30 : 20;
    const baseMerit = Math.max(20, coins * multiplier);

    state.offerings[giftType] = (state.offerings[giftType] || 0) + 1;
    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 3);

    const wish = params.wish || `Dâng cúng ${giftName} lên Tam Bảo`;
    const { devotee, finalMeritDelta, triggeredCommunityGoal } = recordDevotee(
      user,
      uniqueId,
      avatar,
      baseMerit,
      3,
      1,
      wish
    );

    const ttsText =
      params.readTts === false
        ? ''
        : `Công đức vô lượng! Cảm tạ ${getMeritTitle(devotee.merit)} ${devotee.name} đã phát tâm dâng cúng ${giftName}, tích thêm ${finalMeritDelta} điểm công đức. Nguyện cầu chư Phật gia hộ vạn sự cát tường như ý.`;

    const event = pushEventLog({
      type: giftType === 'dragon' ? 'grandCeremony' : 'offerGift',
      priority: params.manual ? 10 : giftType === 'dragon' ? 5 : 4,
      manual: Boolean(params.manual),
      user: devotee.name,
      title: getMeritTitle(devotee.merit),
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      giftType,
      giftName,
      coins,
      merit: finalMeritDelta,
      triggeredCommunityGoal,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'hoaimy'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  drawFortune(params = {}) {
    const user = sanitizeUserName(params.user, params.uniqueId);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const rawTopic = sanitizeWishText(params.topic) || 'Gia đạo, Tài lộc và Bình an';
    const detected = detectFortuneTopic(rawTopic);
    const baseFortune = FORTUNE_DECK[Math.floor(Math.random() * FORTUNE_DECK.length)];

    const customAdvice =
      detected.key !== 'general' && baseFortune.topics?.[detected.key]
        ? baseFortune.topics[detected.key]
        : baseFortune.meaning;

    const fortune = {
      ...baseFortune,
      topicLabel: detected.label,
      customAdvice
    };

    const baseMerit = 10;
    state.fortuneCount += 1;
    const { devotee, finalMeritDelta, triggeredCommunityGoal } = recordDevotee(
      user,
      uniqueId,
      avatar,
      baseMerit,
      0,
      0,
      `Xin xăm (${detected.label}): Quẻ số ${fortune.number} (${fortune.rank})`
    );

    const ttsText =
      params.readTts === false
        ? ''
        : `Thí chủ ${devotee.name} cầu về ${detected.label}, vừa gieo được Quẻ số ${fortune.number}, ${fortune.rank}, ${fortune.title}. ${customAdvice}`;

    const event = pushEventLog({
      type: 'drawFortune',
      priority: params.manual ? 10 : 3,
      manual: Boolean(params.manual),
      user: devotee.name,
      title: getMeritTitle(devotee.merit),
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      topic: rawTopic,
      fortune,
      merit: finalMeritDelta,
      triggeredCommunityGoal,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'hoaimy'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  grandCeremony(params = {}) {
    return this.offerGift({
      ...params,
      giftType: 'dragon',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Hào Quang Vạn Trượng'
    });
  },

  updateSettings(params = {}) {
    state.settings = {
      ...state.settings,
      ...params
    };
    if (typeof params.autoSim === 'boolean') {
      configureAutoSim(params.autoSim);
    } else if (typeof params.autoSimIntervalMs === 'number' && state.settings.autoSim) {
      configureAutoSim(true);
    }
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  resetMerit() {
    state.totalIncense = 9;
    state.totalMerit = 0;
    state.woodenFishHits = 0;
    state.bellRings = 0;
    state.lanternCount = 0;
    state.fortuneCount = 0;
    state.activeIncenseSticks = 3;
    state.offerings = { lotus: 1, fruit: 1, lamp: 1, dragon: 0 };
    state.devotees = {};
    state.recentEvents = [];
    meritMultiplierUntil = 0;
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  }
};

// ============================================================================
// 5. TIKTOK LIVE CONNECTOR, CHÍNH XÁC HÓA REGEX TỪ KHÓA & GOM NHÓM GIFT STREAK
// ============================================================================
let tiktokConn = null;

const commentCooldownMap = new Map();

// Regex ranh giới từ tiếng Việt chính xác (Tránh bắt nhầm 'quê', 'khỏe', 'quên' thành 'quẻ')
const FORTUNE_KEYWORD_RE = /(?:^|\s)(xin\s*xăm|xin\s*xam|gieo\s*quẻ|gieo\s*que|rút\s*quẻ|rut\s*que|bốc\s*quẻ|boc\s*que|xin\s*quẻ|xin\s*que|quẻ\s*xăm|que\s*xam|xem\s*quẻ)(?=\s|$|[.,!?])/i;
const BELL_KEYWORD_RE = /(?:^|\s)(thỉnh\s*chuông|thinh\s*chuong|đánh\s*chuông|rung\s*chuông|chuông\s*chùa)(?=\s|$|[.,!?])/i;
const WOODFISH_KEYWORD_RE = /(?:^|\s)(gõ\s*mõ|go\s*mo|tụng\s*kinh|tung\s*kinh)(?=\s|$|[.,!?])/i;
const INCENSE_KEYWORD_RE = /(?:^|\s)(thắp\s*hương|thap\s*huong|dâng\s*hương|dang\s*huong|thắp\s*nhang|bái\s*phật|bai\s*phat|lạy\s*phật|lay\s*phat|kính\s*lễ)(?=\s|$|[.,!?])/i;
const PRAYER_KEYWORD_RE = /(?:^|\s)(cầu\s*nguyện|cau\s*nguyen|cầu\s*an|cầu\s*phúc|cầu\s*tài|cầu\s*duyên|cầu\s*cho|cầu\s*mong|nguyện\s*cầu|nam\s*mô|nam\s*mo|mô\s*phật|mo\s*phat|a\s*di\s*đà|a\s*di\s*da|bình\s*an|tài\s*lộc|chúc\s*cho|con\s*cầu|con\s*xin)(?=\s|$|[.,!?])/i;

function parseViewerComment(commentText, user, uniqueId, avatar, options = {}) {
  const fromLiveStream = Boolean(options.fromLiveStream);
  const manual = !fromLiveStream;
  const raw = String(commentText || '').trim();
  if (!raw || (fromLiveStream && isBlockedSpamOrToxic(raw))) {
    return null;
  }

  const cleanWish = sanitizeWishText(raw) || (!fromLiveStream ? raw.slice(0, 120) : '');
  if (!cleanWish || (fromLiveStream && cleanWish.length < 3)) {
    return null;
  }

  // Chống 1 người spam bình luận liên tục trên TikTok Live làm nghẽn hàng đợi TTS (cooldown 3.5 giây/người)
  if (fromLiveStream) {
    const userKey = uniqueId || user || '';
    const now = Date.now();
    if (userKey) {
      const lastTs = commentCooldownMap.get(userKey) || 0;
      if (now - lastTs < 3500) {
        return null;
      }
      commentCooldownMap.set(userKey, now);
      if (commentCooldownMap.size > 600) {
        const oldestKey = commentCooldownMap.keys().next().value;
        commentCooldownMap.delete(oldestKey);
      }
    }
  }

  const cleanUser = sanitizeUserName(user, uniqueId);

  // 1. Xin xăm / Gieo quẻ (Kiểm tra cụm từ chuẩn xác)
  if (FORTUNE_KEYWORD_RE.test(cleanWish)) {
    return Rituals.drawFortune({ user: cleanUser, uniqueId, avatar, topic: cleanWish, manual });
  }

  // 2. Thỉnh chuông
  if (BELL_KEYWORD_RE.test(cleanWish)) {
    return Rituals.ringBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true, manual });
  }

  // 3. Gõ mõ
  if (WOODFISH_KEYWORD_RE.test(cleanWish)) {
    return Rituals.strikeWoodenFish({ user: cleanUser, uniqueId, avatar, count: 3, manual });
  }

  // 4. Thắp hương / Bái Phật
  if (INCENSE_KEYWORD_RE.test(cleanWish)) {
    return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 3, wish: cleanWish, manual });
  }

  // 5. Cầu nguyện / Thả đèn hoa đăng
  if (PRAYER_KEYWORD_RE.test(cleanWish)) {
    return Rituals.sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish, manual });
  }

  return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, manual });
}

// Bộ gom nhóm Gift Streak thông minh (Tránh xé lẻ 10 bông hồng thành 10 lần đọc TTS gây nghẽn)
const pendingGiftStreaks = new Map();

function flushGiftStreak(streakKey) {
  const entry = pendingGiftStreaks.get(streakKey);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingGiftStreaks.delete(streakKey);

  const totalCoins = entry.diamondCount * entry.count;
  const displayGiftName = entry.count > 1 ? `${entry.count}x ${entry.rawGiftName}` : entry.rawGiftName;

  console.log(`[TikTok Gift] ${entry.user} gửi ${displayGiftName} (${totalCoins} xu)`);

  Rituals.offerGift({
    user: entry.user,
    uniqueId: entry.uniqueId,
    avatar: entry.avatar,
    coins: totalCoins,
    giftName: displayGiftName,
    wish: `Thành tâm dâng ${displayGiftName} kính lễ Đức Phật A Di Đà`
  });
}

async function resolveTikTokUsername(rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) {
    throw new Error('Vui lòng nhập @username hoặc link TikTok Live cần kết nối');
  }
  if (input.startsWith('http://') || input.startsWith('https://') || input.includes('tiktok.com/')) {
    const urlToFetch = input.startsWith('http') ? input : `https://${input}`;
    const directMatch = urlToFetch.match(/tiktok\.com\/@([^/?#]+)/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }
    try {
      const resp = await fetch(urlToFetch, { redirect: 'follow' });
      const finalUrl = resp.url || '';
      const resolvedMatch = finalUrl.match(/tiktok\.com\/@([^/?#]+)/i);
      if (resolvedMatch && resolvedMatch[1]) {
        return resolvedMatch[1];
      }
    } catch (e) {
      console.warn('[TikTok URL Resolve Warning]', e.message);
    }
  }
  return input.replace(/^@/, '').split(/[/?#]/)[0].trim();
}

function extractUserFromEvent(data) {
  const u = data?.user || data || {};
  const uniqueId = u.uniqueId || u.displayId || data?.uniqueId || '';
  const user = u.nickname || uniqueId || data?.nickname || 'Thí Chủ';
  const avatar =
    u.profilePictureUrl ||
    u.avatarLarge?.urlList?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    data?.profilePictureUrl ||
    '';
  return { user, uniqueId, avatar };
}

async function connectTikTokLive(usernameOrUrl) {
  const cleanUser = await resolveTikTokUsername(usernameOrUrl);
  if (!cleanUser) {
    throw new Error('Không tìm thấy @username hợp lệ từ dữ liệu nhập vào');
  }

  if (tiktokConn) {
    try {
      await tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }

  state.tiktok = {
    connected: false,
    connecting: true,
    username: cleanUser,
    roomId: null,
    viewerCount: 0,
    lastError: null
  };
  broadcastNotification('temple.state', getPublicState());

  tiktokConn = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    fetchRoomInfoOnConnect: false,
    enableExtendedGiftInfo: false
  });

  tiktokConn.on(ControlEvent.CONNECTED, (roomState) => {
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    state.tiktok.lastError = null;
    console.log(`[TikTok Live] Đã kết nối phòng @${cleanUser} (roomId: ${state.tiktok.roomId})`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.DISCONNECTED, () => {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    console.log(`[TikTok Live] Đã ngắt kết nối @${cleanUser}`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.ERROR, (err) => {
    state.tiktok.lastError = err?.message || String(err);
    console.warn('[TikTok Live Warning]', state.tiktok.lastError);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(WebcastEvent.ROOM_USER, (data) => {
    const viewerCount = Number(data?.total ?? data?.viewerCount ?? 0);
    if (viewerCount >= 0) {
      state.tiktok.viewerCount = viewerCount;
      broadcastNotification('temple.viewerCount', {
        viewerCount,
        username: state.tiktok.username
      });
    }
  });

  tiktokConn.on(WebcastEvent.MEMBER, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    recordDevotee(user, uniqueId, avatar, 1, 0, 0, 'Đã vào Chánh Điện lễ Phật');
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(WebcastEvent.CHAT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const commentText = data?.content || data?.comment || '';
    console.log(`[TikTok Chat] ${user}: ${commentText}`);
    parseViewerComment(commentText, user, uniqueId, avatar, { fromLiveStream: true });
  });

  tiktokConn.on(WebcastEvent.LIKE, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const likeCount = Math.min(15, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
    Rituals.strikeWoodenFish({ user, uniqueId, avatar, count: likeCount });
  });

  const handleSocialEvent = (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    Rituals.ringBell({
      user,
      uniqueId,
      avatar,
      count: 1,
      wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn',
      readTts: false
    });
  };
  tiktokConn.on(WebcastEvent.FOLLOW, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SHARE, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SOCIAL, (data) => {
    const action = String(data?.action || '');
    const disp = String(data?.common?.displayText?.displayType || data?.displayType || '').toLowerCase();
    if (action === '1' || action === '3' || disp.includes('follow') || disp.includes('share')) {
      handleSocialEvent(data);
    }
  });

  tiktokConn.on(WebcastEvent.GIFT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const giftObj = data?.gift || data?.giftDetails || {};
    const giftId = String(data?.giftId || giftObj?.id || 'rose');
    const streakKey = String(data?.groupId || `${uniqueId || user}_${giftId}`);
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));
    const diamondCount = Math.max(1, Number(giftObj?.diamondCount || data?.diamondCount || 1));
    const rawGiftName = giftObj?.name || data?.giftName || giftObj?.describe || 'Hoa Hồng Tâm Thành';
    const isStreakable = Number(giftObj?.giftType || data?.giftType) === 1;

    // Nếu quà không phải dạng streak hoặc đã kết thúc streak (repeatEnd === true)
    if (!isStreakable || data?.repeatEnd) {
      const existing = pendingGiftStreaks.get(streakKey);
      if (existing) {
        existing.count = Math.max(existing.count, repeatCount);
        flushGiftStreak(streakKey);
      } else {
        pendingGiftStreaks.set(streakKey, {
          user,
          uniqueId,
          avatar,
          diamondCount,
          rawGiftName,
          count: repeatCount,
          timer: null
        });
        flushGiftStreak(streakKey);
      }
      return;
    }

    // Quà dạng streak đang bấm liên hoàn: gom nhóm trong 1.8 giây để tránh spam 10 lần TTS
    const existing = pendingGiftStreaks.get(streakKey);
    if (existing) {
      clearTimeout(existing.timer);
      existing.count = Math.max(existing.count, repeatCount);
      existing.timer = setTimeout(() => flushGiftStreak(streakKey), 1800);
    } else {
      const timer = setTimeout(() => flushGiftStreak(streakKey), 1800);
      pendingGiftStreaks.set(streakKey, {
        user,
        uniqueId,
        avatar,
        diamondCount,
        rawGiftName,
        count: repeatCount,
        timer
      });
    }
  });

  try {
    const roomState = await tiktokConn.connect();
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    state.tiktok.lastError = null;
    broadcastNotification('temple.state', getPublicState());
    return state.tiktok;
  } catch (err) {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    const rawMsg = String(err?.message || err || '');
    let friendlyErr = rawMsg || 'Không thể kết nối phòng Live';
    if (/retrieve room id|not live|offline|live_has_ended|room_not_found|isn't live/i.test(rawMsg)) {
      friendlyErr = `Kênh @${cleanUser} hiện CHƯA PHÁT LIVE (Offline) hoặc đã kết thúc phiên Live.`;
    } else if (/user_not_found|invalid/i.test(rawMsg)) {
      friendlyErr = `Không tìm thấy tài khoản TikTok @${cleanUser}.`;
    }
    state.tiktok.lastError = friendlyErr;
    broadcastNotification('temple.state', getPublicState());
    throw new Error(state.tiktok.lastError);
  }
}

function disconnectTikTokLive() {
  if (tiktokConn) {
    try {
      tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }
  state.tiktok.connected = false;
  state.tiktok.connecting = false;
  state.tiktok.viewerCount = 0;
  state.tiktok.lastError = null;
  broadcastNotification('temple.state', getPublicState());
  return state.tiktok;
}

// ============================================================================
// 6. AUTO-SIMULATION ENGINE (CHẾ ĐỘ TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI XEM)
// ============================================================================
let autoSimTimer = null;
const SIM_DEVOTEES = [
  { user: 'Ngọc Anh Nguyễn', uniqueId: 'ngocanh.98', wish: 'Con thành tâm cầu cho bố mẹ luôn mạnh khỏe, bình an' },
  { user: 'Trần Minh Quân', uniqueId: 'minhquan_bds', wish: 'Cầu tháng mới công việc thuận buồm xuôi gió, tài lộc hanh thông' },
  { user: 'Diệu Thảo Tâm An', uniqueId: 'tam_an_99', wish: 'Nam Mô A Di Đà Phật, nguyện cầu thế giới hòa bình chúng sinh an lạc' },
  { user: 'Lê Hoàng Nam', uniqueId: 'hoangnam.dev', wish: 'Con xin gieo quẻ cầu thi cử đỗ đạt điểm cao, sự nghiệp rộng mở' },
  { user: 'Phạm Thanh Hà', uniqueId: 'thanhha.lotus', wish: 'Cầu tình duyên êm ấm, gia đình hạnh phúc viên mãn' },
  { user: 'Vũ Đức Thịnh', uniqueId: 'ducthinh88', wish: 'Con xin gieo một quẻ cầu tài lộc kinh doanh đầu tháng' }
];

function runSingleSimulationStep() {
  const pick = SIM_DEVOTEES[Math.floor(Math.random() * SIM_DEVOTEES.length)];
  const roll = Math.random();
  if (roll < 0.30) {
    Rituals.burnIncense({ user: pick.user, uniqueId: pick.uniqueId, count: 3, wish: pick.wish });
  } else if (roll < 0.55) {
    Rituals.sendPrayer({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
  } else if (roll < 0.75) {
    Rituals.drawFortune({ user: pick.user, uniqueId: pick.uniqueId, topic: pick.wish });
  } else if (roll < 0.90) {
    Rituals.offerGift({
      user: pick.user,
      uniqueId: pick.uniqueId,
      giftType: 'lotus',
      coins: 15,
      giftName: 'Hoa Sen Vàng Tinh Khiết'
    });
  } else {
    Rituals.ringBell({ user: pick.user, uniqueId: pick.uniqueId, count: 1, wish: pick.wish, readTts: true });
  }
}

function configureAutoSim(enabled) {
  state.settings.autoSim = Boolean(enabled);
  if (autoSimTimer) {
    clearInterval(autoSimTimer);
    autoSimTimer = null;
  }
  if (state.settings.autoSim) {
    runSingleSimulationStep();
    autoSimTimer = setInterval(runSingleSimulationStep, state.settings.autoSimIntervalMs || 9500);
  }
}

// ============================================================================
// 7. JSON-RPC 2.0 DISPATCHER
// ============================================================================
async function handleRpcCall(method, params = {}) {
  switch (method) {
    case 'temple.getState':
      return getPublicState();
    case 'temple.burnIncense':
      return Rituals.burnIncense(params);
    case 'temple.strikeWoodenFish':
      return Rituals.strikeWoodenFish(params);
    case 'temple.ringBell':
      return Rituals.ringBell(params);
    case 'temple.sendPrayer':
      return Rituals.sendPrayer(params);
    case 'temple.offerGift':
      return Rituals.offerGift(params);
    case 'temple.drawFortune':
      return Rituals.drawFortune(params);
    case 'temple.grandCeremony':
      return Rituals.grandCeremony(params);
    case 'temple.updateSettings':
      return Rituals.updateSettings(params);
    case 'temple.resetMerit':
      return Rituals.resetMerit();
    case 'temple.comment':
      return parseViewerComment(params.comment, params.user, params.uniqueId, params.avatar);
    case 'temple.speak': {
      const res = await zeroTts.synthesize(params.text, params.voice || 'maichi');
      if (res.ok && params.broadcast !== false) {
        broadcastNotification('tts.play', {
          text: params.text,
          voice: res.voice,
          url: res.url
        });
      }
      return res;
    }
    case 'temple.ttsStatus':
      return zeroTts.getStatus();
    case 'live.connect':
      return await connectTikTokLive(params.username);
    case 'live.disconnect':
      return disconnectTikTokLive();
    case 'live.setAutoSim':
      configureAutoSim(Boolean(params.enabled));
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    default:
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
  }
}

// ============================================================================
// 8. EXPRESS + WEBSOCKET SERVER
// ============================================================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/tts-cache', express.static(TTS_CACHE_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Phục vụ favicon.ico hình Hoa Sen để trình duyệt không bao giờ báo lỗi 404
app.get('/favicon.ico', (_req, res) => {
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="52" font-size="52">🪷</text></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.send(svgIcon);
});

// Phục vụ /assets/bg_chant.m4a (trả về 204 nếu chưa có file để trình duyệt không báo đỏ 404 trong DevTools)
app.get('/assets/bg_chant.m4a', (_req, res) => {
  const filePath = path.join(__dirname, 'public', 'assets', 'bg_chant.m4a');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  return res.status(204).end();
});

// HTTP JSON-RPC 2.0 Endpoint
app.post('/rpc', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (!method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
    });
  }
  try {
    const result = await handleRpcCall(method, params || {});
    res.json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      result
    });
  } catch (err) {
    res.status(200).json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      error: { code: -32000, message: err.message || 'Server error' }
    });
  }
});

// ZeroTTS / Cloud TTS HTTP Endpoint
app.all('/api/tts', async (req, res) => {
  const text = (req.body?.text || req.query?.text || '').trim();
  const voice = (req.body?.voice || req.query?.voice || state.settings.ttsVoice || 'maichi').trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: 'Thiếu nội dung text cần đọc' });
  }
  const result = await zeroTts.synthesize(text, voice);
  res.json(result);
});

app.get('/api/state', (_req, res) => {
  res.json(getPublicState());
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastNotification(method, params) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'temple.state',
      params: getPublicState()
    })
  );

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!msg || !msg.method) return;
    try {
      const result = await handleRpcCall(msg.method, msg.params || {});
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result
          })
        );
      }
    } catch (err) {
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32000, message: err.message || 'RPC Error' }
          })
        );
      }
    }
  });
});

const zeroTts = new ZeroTTSManager();

if (state.settings.autoSim) {
  configureAutoSim(true);
}

server.listen(PORT, () => {
  console.log(`============================================================`);
  console.log(`🪷 CHÙA ONLINE TIKTOK LIVE RPC v2.0 ĐÃ KHỞI ĐỘNG`);
  console.log(`📺 Màn hình Live (9:16 OBS): http://localhost:${PORT}`);
  console.log(`🎛️ Bảng điều khiển RPC Admin: http://localhost:${PORT}/admin`);
  console.log(`🔌 JSON-RPC 2.0 Endpoint   : http://localhost:${PORT}/rpc (ws://localhost:${PORT}/ws)`);
  console.log(`============================================================`);

  if (process.env.TIKTOK_USER) {
    connectTikTokLive(process.env.TIKTOK_USER).catch((err) => {
      console.warn(`[Auto-Connect @${process.env.TIKTOK_USER}] Chưa kết nối được ngay:`, err.message);
    });
  }
});

process.on('uncaughtException', (err) => {
  console.error('[Guard] Uncaught Exception (Server vẫn tiếp tục chạy 24/7):', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Guard] Unhandled Rejection (Server vẫn tiếp tục chạy 24/7):', reason?.message || reason);
});
