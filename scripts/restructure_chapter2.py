from __future__ import annotations

import copy
import re
import sys
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


SOURCE = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])


def element_text(element) -> str:
    return "".join(element.itertext()).strip()


def paragraph_text(element) -> str:
    if element.tag != qn("w:p"):
        return ""
    return "".join(node.text or "" for node in element.iter(qn("w:t"))).strip()


def replace_paragraph_text(element, text: str) -> None:
    p_pr = element.find(qn("w:pPr"))
    first_r_pr = None
    for run in element.findall(qn("w:r")):
        r_pr = run.find(qn("w:rPr"))
        if r_pr is not None:
            first_r_pr = copy.deepcopy(r_pr)
            break
    for child in list(element):
        if child is not p_pr:
            element.remove(child)
    run = OxmlElement("w:r")
    if first_r_pr is not None:
        run.append(first_r_pr)
    text_node = OxmlElement("w:t")
    if text.startswith(" ") or text.endswith(" "):
        text_node.set(qn("xml:space"), "preserve")
    text_node.text = text
    run.append(text_node)
    element.append(run)


def make_paragraph_like(template, text: str):
    paragraph = OxmlElement("w:p")
    p_pr = template.find(qn("w:pPr"))
    if p_pr is not None:
        paragraph.append(copy.deepcopy(p_pr))
    first_r_pr = None
    for run in template.findall(qn("w:r")):
        r_pr = run.find(qn("w:rPr"))
        if r_pr is not None:
            first_r_pr = copy.deepcopy(r_pr)
            break
    run = OxmlElement("w:r")
    if first_r_pr is not None:
        run.append(first_r_pr)
    text_node = OxmlElement("w:t")
    text_node.text = text
    run.append(text_node)
    paragraph.append(run)
    return paragraph


def copy_paragraph_properties(target, template) -> None:
    current = target.find(qn("w:pPr"))
    if current is not None:
        target.remove(current)
    template_properties = template.find(qn("w:pPr"))
    if template_properties is not None:
        target.insert(0, copy.deepcopy(template_properties))


def find_index(elements, prefix: str, start: int = 0) -> int:
    for index in range(start, len(elements)):
        if paragraph_text(elements[index]).startswith(prefix):
            return index
    raise ValueError(f"Không tìm thấy đoạn bắt đầu bằng: {prefix}")


def find_last_index(elements, prefix: str) -> int:
    matches = [
        index
        for index, element in enumerate(elements)
        if paragraph_text(element).startswith(prefix)
    ]
    if not matches:
        raise ValueError(f"Không tìm thấy đoạn bắt đầu bằng: {prefix}")
    return matches[-1]


def block(elements, start_prefix: str, end_prefix: str):
    start = find_index(elements, start_prefix)
    end = find_index(elements, end_prefix, start + 1)
    return list(elements[start:end])


def first_paragraph(elements):
    for element in elements:
        if element.tag == qn("w:p"):
            return element
    raise ValueError("Khối không có đoạn văn.")


def replace_exact_in_block(elements, old: str, new: str) -> None:
    for element in elements:
        if paragraph_text(element) == old:
            replace_paragraph_text(element, new)
            return
    raise ValueError(f"Không tìm thấy đoạn cần thay thế: {old}")


def replace_prefix_in_block(elements, prefix: str, new: str) -> None:
    for element in elements:
        if paragraph_text(element).startswith(prefix):
            replace_paragraph_text(element, new)
            return
    raise ValueError(f"Không tìm thấy đoạn có tiền tố: {prefix}")


document = Document(SOURCE)
body = document._element.body
original_elements = list(body)

chapter2_body_index = find_last_index(
    original_elements, "CHƯƠNG 2. PHƯƠNG PHÁP VÀ NỘI DUNG NGHIÊN CỨU"
)
chapter3_body_index = find_index(original_elements, "CHƯƠNG 3.", chapter2_body_index + 1)
chapter_elements = original_elements[chapter2_body_index:chapter3_body_index]

p21_relative = find_index(chapter_elements, "2.1. Cơ sở lý thuyết")
old22_relative = find_index(chapter_elements, "2.2. Mô hình lý thuyết", p21_relative)
p21_index = chapter2_body_index + p21_relative
old22_index = chapter2_body_index + old22_relative

section_heading_template = original_elements[p21_index]
subsection_template = chapter_elements[find_index(chapter_elements, "2.1.2. Các kiến trúc")]
subsubsection_template = chapter_elements[find_index(chapter_elements, "2.1.2.1.")]
body_template = chapter_elements[find_index(chapter_elements, "Đề tài tiếp cận bài toán")]
letter_heading_template = chapter_elements[find_index(chapter_elements, "a) Những đặc trưng")]

methods_block = block(
    chapter_elements,
    "2.1.1. Các phương pháp giải quyết bài toán",
    "2.1.2. Các kiến trúc sử dụng",
)
micro_block = block(
    chapter_elements,
    "2.1.2.1. Giới thiệu về Microservices",
    "2.1.2.2. Giới thiệu về kiến trúc Headless",
)
headless_block = block(
    chapter_elements,
    "2.1.2.2. Giới thiệu về kiến trúc Headless",
    "2.1.2.3. Sự kết hợp",
)
combined_block = block(
    chapter_elements,
    "2.1.2.3. Sự kết hợp",
    "2.1.3. Công nghệ, nền tảng xây dựng",
)
next_block = block(chapter_elements, "2.1.3.1. Next.js", "2.1.3.2.")
flutter_block = block(chapter_elements, "2.1.3.2.", "2.1.3.3.")
postgres_block = block(chapter_elements, "2.1.3.3.", "2.1.3.4.")
docker_block = block(chapter_elements, "2.1.3.4.", "2.1.4.")
ai_overview_block = block(chapter_elements, "2.1.4.1.", "2.1.4.2.")
rule_block = block(chapter_elements, "2.1.4.2.", "2.1.4.3.")
kmeans_block = block(chapter_elements, "2.1.4.3.", "2.1.4.4.")
collaborative_block = block(chapter_elements, "2.1.4.4.", "2.2. Mô hình lý thuyết")

# Loại bỏ tiêu đề cũ "Các phương pháp..." nhưng giữ phần mô tả phương pháp
# như đoạn dẫn nhập của cơ sở lý thuyết.
methods_content = methods_block[1:]

replace_paragraph_text(first_paragraph(micro_block), "2.1.1.1. Mô hình Monolithic và Microservices")
replace_paragraph_text(first_paragraph(headless_block), "2.1.1.2. Kiến trúc Headless và cơ chế giao tiếp API")
replace_paragraph_text(first_paragraph(combined_block), "2.1.1.3. Căn cứ lựa chọn kiến trúc cho hệ thống NhàHợp")
replace_paragraph_text(first_paragraph(kmeans_block), "2.1.2.1. Thuật toán phân cụm K-means")
replace_paragraph_text(first_paragraph(rule_block), "a) Lọc theo quy tắc (Rule-based Filtering)")
replace_paragraph_text(first_paragraph(collaborative_block), "b) Lọc cộng tác (Collaborative Filtering)")
replace_paragraph_text(first_paragraph(postgres_block), "2.2.1. PostgreSQL và Supabase")
replace_paragraph_text(first_paragraph(next_block), "2.2.3.1. Next.js")
replace_paragraph_text(first_paragraph(flutter_block), "2.2.3.2. Flutter")
replace_paragraph_text(first_paragraph(docker_block), "2.2.4. Docker và công nghệ container hóa")
copy_paragraph_properties(first_paragraph(postgres_block), subsection_template)
copy_paragraph_properties(first_paragraph(docker_block), subsection_template)

# Điều chỉnh các ví dụ kiến trúc theo đúng mã nguồn hiện tại.
replace_exact_in_block(
    micro_block,
    "Thay vì gộp chung tất cả vào một khối, hệ thống Coliving được chia thành các dịch vụ nhỏ chuyên biệt như: Service Quản lý phòng, Service Thanh toán, Service Hợp đồng, và Service Cư dân. Mỗi dịch vụ đảm nhiệm một logic riêng biên và giao tiếp với nhau qua HTTP/REST hoặc gRPC, giúp luồng dữ liệu minh bạch và dễ kiểm soát.",
    "Thay vì gộp toàn bộ chức năng vào một khối, hệ thống NhàHợp được phân tách theo các miền nghiệp vụ gồm Identity Service, Property Service, Rental Service, Community Service, Preference Service và AI Service. Mỗi dịch vụ đảm nhiệm một nhóm trách nhiệm rõ ràng, cung cấp RESTful API và trao đổi sự kiện bất đồng bộ qua RabbitMQ khi cần đồng bộ dữ liệu giữa các miền.",
)
replace_exact_in_block(
    micro_block,
    'Nếu dịch vụ "Gửi thông báo" gặp sự cố, cư dân có thể tạm thời không nhận được tin nhắn hay mail, nhưng họ vẫn có thể thực hiện việc mở khóa phòng thông minh hoặc thanh toán hóa đơn. Tránh tình trạng "sụp đổ dây chuyền" thường thấy trong các hệ thống truyền thống.',
    "Khi một dịch vụ gặp sự cố, phạm vi ảnh hưởng có thể được giới hạn trong miền nghiệp vụ của dịch vụ đó. Chẳng hạn, sự cố ở Community Service có thể làm gián đoạn đánh giá hoặc đặt tài nguyên dùng chung, nhưng không nhất thiết ngăn người dùng tìm phòng hoặc xem hợp đồng. Khả năng cô lập lỗi này phụ thuộc vào việc thiết kế timeout, retry, kiểm tra sức khỏe dịch vụ và xử lý trạng thái suy giảm phù hợp.",
)
replace_exact_in_block(
    micro_block,
    'Hệ thống Coliving có thể sử dụng các công nghệ khác nhau để tối ưu: Ví dụ, dịch vụ "Tìm kiếm phòng theo vị trí" có thể dùng Elasticsearch, trong khi dịch vụ "Xử lý giao dịch" lại ưu tiên các ngôn ngữ có tính chặt chẽ cao. Điều này giúp tận dụng tối đa sức mạnh của từng loại công nghệ cho từng bài toán cụ thể.',
    "Mỗi dịch vụ có thể lựa chọn công nghệ phù hợp với đặc thù xử lý. Trong dự án, các dịch vụ nghiệp vụ sử dụng Node.js, Express và Prisma, trong khi AI Service sử dụng Python, FastAPI và scikit-learn. Sự đa dạng này hỗ trợ khai thác hệ sinh thái học máy của Python mà không buộc toàn bộ backend phải chuyển sang cùng một công nghệ.",
)

replace_prefix_in_block(
    headless_block,
    "Kiến trúc Headless ra đời với triết lý",
    "Kiến trúc Headless tách lớp trình bày khỏi lớp xử lý nghiệp vụ và dữ liệu. Backend không sinh giao diện cụ thể mà công bố chức năng thông qua API; các ứng dụng web, mobile hoặc một kênh giao diện khác tiêu thụ cùng nguồn dữ liệu và tự quyết định cách hiển thị. API có thể được thiết kế theo RESTful hoặc GraphQL. RESTful tổ chức tài nguyên theo endpoint và phương thức HTTP, còn GraphQL cho phép client mô tả chính xác trường dữ liệu cần lấy. Trong NhàHợp, RESTful được lựa chọn vì phù hợp với các microservice hiện có, dễ kiểm thử, dễ quan sát và tương thích trực tiếp với Next.js và Flutter.",
)
replace_exact_in_block(
    combined_block,
    "Hệ thống backend chia nhỏ thành các dịch vụ độc lộc, giúp dễ mở rộng và bảo trì",
    "Hệ thống backend được chia thành các dịch vụ tương đối độc lập, giúp giới hạn phạm vi thay đổi, hỗ trợ bảo trì và mở rộng theo từng miền nghiệp vụ.",
)
replace_exact_in_block(
    combined_block,
    "Frontend và mobile app đều sử dụng API chung một cách linh hoạt",
    "Ứng dụng web và ứng dụng mobile sử dụng hệ thống API chung, nhờ đó logic nghiệp vụ được tái sử dụng và dữ liệu được trình bày nhất quán trên nhiều nền tảng.",
)

# Làm rõ AI và sửa các lỗi diễn đạt quan trọng.
ai_replacements = {
    "Trí tuệ Nhân tạo (AI) là khả năng của máy móc trong việc học hỏi, phát triển, và tự hoàn thiện qua thời gian, điều làm nó trở nên vượt trội, và khác biệt so với máy móc truyền thống.": (
        "Trí tuệ nhân tạo (Artificial Intelligence - AI) là lĩnh vực nghiên cứu các phương pháp cho phép hệ thống máy tính thực hiện những nhiệm vụ cần đến suy luận, nhận dạng mẫu hoặc ra quyết định. Học máy (Machine Learning - ML) là một nhánh của AI, trong đó mô hình khai thác dữ liệu để tìm quy luật và cải thiện kết quả dự đoán hoặc gợi ý."
    ),
    "Trong đề tài này, nhóm nghiên cứu ứng dụng ba hướng tiếp cận chính gồm: Rule-based Matching, K-means Clustering và Collaborative Filter.": (
        "Trong đề tài, hệ thống kết hợp ba hướng tiếp cận gồm lọc theo quy tắc, K-means Clustering và Collaborative Filtering. Các phương pháp không hoạt động độc lập mà được tổ chức thành một hệ gợi ý lai: luật nghiệp vụ loại bỏ lựa chọn không hợp lệ, K-means bổ sung thông tin về nhóm lối sống và Collaborative Filtering khai thác lịch sử tương tác để hỗ trợ xếp hạng."
    ),
}
for old, new in ai_replacements.items():
    replace_exact_in_block(ai_overview_block, old, new)
replace_prefix_in_block(
    ai_overview_block,
    "Trong bối cảnh hiện đại, AI không còn",
    "Khác với hệ thống chỉ thực hiện tập lệnh cố định, mô hình học máy xác định mẫu từ dữ liệu và tối ưu tham số theo một mục tiêu cụ thể. Tuy vậy, quy tắc nghiệp vụ vẫn cần thiết trong các bài toán có điều kiện bắt buộc. Vì thế, hệ thống NhàHợp kết hợp phương pháp dựa trên luật với học máy thay vì xem hai nhóm phương pháp này loại trừ lẫn nhau.",
)
replace_prefix_in_block(
    ai_overview_block,
    "Recommendation System được sử dụng",
    "Hệ gợi ý được ứng dụng trong thương mại điện tử, giải trí, giáo dục, tuyển dụng và nhiều nền tảng dịch vụ. Thay vì hiển thị cùng một nội dung cho mọi người, hệ thống khai thác hồ sơ, ngữ cảnh và lịch sử tương tác để sắp xếp các lựa chọn phù hợp hơn với từng người dùng.",
)
replace_prefix_in_block(
    ai_overview_block,
    "Trong bối cảnh hiện nay, các",
    "Đối với co-living, AI hỗ trợ phân tích đồng thời nhu cầu tìm phòng và khả năng hòa hợp khi sống chung. Các đặc trưng như ngân sách, vị trí, giờ giấc, mức độ sạch sẽ, hút thuốc, vật nuôi, tiếp khách và nhu cầu riêng tư được sử dụng để lọc, phân nhóm và xếp hạng kết quả.",
)
replace_prefix_in_block(
    ai_overview_block,
    "Phương pháp Rule-based được dùng",
    "Rule-based Filtering biểu diễn các điều kiện nghiệp vụ rõ ràng như sức chứa, ngân sách, giới tính, hút thuốc và vật nuôi. Phương pháp giúp loại bỏ sớm những lựa chọn vi phạm điều kiện bắt buộc, giảm xung đột và thu hẹp không gian tìm kiếm trước khi chấm điểm.",
)
replace_prefix_in_block(
    ai_overview_block,
    "Thuật toán K-means Clustering được áp dụng",
    "K-means Clustering được sử dụng để phân nhóm người dùng theo sự tương đồng của các đặc trưng lối sống. Kết quả phân cụm cung cấp thêm tín hiệu về nhóm cư dân có nếp sinh hoạt gần nhau, hỗ trợ đánh giá người ở ghép và mức độ phù hợp với phòng.",
)
replace_prefix_in_block(
    ai_overview_block,
    "Collaborative Filtering được sử dụng",
    "Collaborative Filtering khai thác các tương tác đã phát sinh giữa người dùng và phòng. Phương pháp dựa trên giả định rằng những người có hành vi tương tự trong quá khứ có xu hướng quan tâm đến các lựa chọn tương tự, nhờ đó bổ sung mức độ cá nhân hóa vượt ra ngoài hồ sơ khai báo ban đầu.",
)

replace_exact_in_block(
    kmeans_block,
    "Thuật toán K-means clustering là một phương pháp phân cụm không giám sát, được sử dụng để nhóm các đối tượng tương đồng vào một cụm. Trọng hệ thống co-living, K-means được sử dụng để gom nhóm những người dùng có thói quen tương tự nhau.",
    "K-means là thuật toán phân cụm không giám sát, dùng để chia các đối tượng thành k nhóm sao cho những đối tượng trong cùng một nhóm có mức độ tương đồng cao. Trong hệ thống NhàHợp, mỗi người dùng được biểu diễn bởi vector đặc trưng lối sống như giờ giấc sinh hoạt, mức độ sạch sẽ, nhu cầu riêng tư, mức độ hòa đồng, thói quen tiếp khách, hút thuốc và vật nuôi. Dữ liệu số được chuẩn hóa trước khi phân cụm để tránh thuộc tính có thang đo lớn chi phối khoảng cách.",
)

replace_exact_in_block(
    collaborative_block,
    "Là phương pháp gợi ý dựa trên hành vi tương tác của người dùng, hoạt động theo giả thuyết những người có những hoạt động trong quá khứ tương tự nhau, thì xu hướng tương lại cũng sẽ giống nhau. Trong hệ thống co-living, phương pháp này được áp dụng để tìm roommate, tìm phòng dựa trên lịch sử xem, đánh giá, đặt phòng. Trong hệ thống co-living, việc ứng dụng Collaborative filtering được biểu diễn thành hai cách tiếp cận phổ biến:",
    "Collaborative Filtering là phương pháp gợi ý dựa trên dữ liệu tương tác, xuất phát từ giả định rằng những người dùng có hành vi tương tự trong quá khứ thường có xu hướng quan tâm đến các đối tượng tương tự. Trong NhàHợp, dữ liệu xem phòng, yêu thích, đánh giá hoặc đặt phòng được tổ chức thành ma trận người dùng - phòng để hỗ trợ xếp hạng. Hai cách tiếp cận phổ biến gồm:",
)
replace_prefix_in_block(
    rule_block,
    "Rule-based là phương pháp",
    "Rule-based Filtering là phương pháp ra quyết định dựa trên tập luật được xác định trước. Phương pháp không tự học trọng số từ dữ liệu mà đánh giá các điều kiện logic do chuyên gia hoặc người phân tích nghiệp vụ thiết kế.",
)
replace_prefix_in_block(
    rule_block,
    "Chỉ các phòng thõa mãn",
    "Chỉ những phòng thỏa mãn toàn bộ điều kiện bắt buộc mới được chuyển sang bước chấm điểm tiếp theo.",
)
replace_prefix_in_block(
    rule_block,
    "Trong đó, wk là trọng số",
    "Trong đó, wₖ là trọng số của tiêu chí thứ k và matchₖ biểu thị mức độ phù hợp của tiêu chí đó. Cách chấm điểm trọng số hữu ích trong giai đoạn đầu khi lịch sử tương tác còn ít, đồng thời vẫn duy trì các ràng buộc an toàn cần thiết cho quá trình sống chung.",
)
replace_prefix_in_block(
    collaborative_block,
    "User-User Collaborative Filtering",
    "User-User Collaborative Filtering (người dùng - người dùng): xác định những người có lịch sử tương tác tương tự. Nếu người dùng A và B có xu hướng quan tâm đến nhiều phòng giống nhau, những phòng A đánh giá cao nhưng B chưa tương tác có thể được đưa vào danh sách gợi ý cho B.",
)
replace_prefix_in_block(
    collaborative_block,
    "Item-Based Collaborative Filtering",
    "Item-Item Collaborative Filtering (phòng - phòng): xác định mức độ tương đồng giữa các phòng dựa trên nhóm người dùng đã tương tác. Khi người dùng quan tâm đến một phòng, hệ thống có thể đề xuất những phòng khác có mẫu tương tác gần với phòng đó.",
)
replace_prefix_in_block(
    flutter_block,
    "Tích hợp dễ dàng với Backend Microservices và Headless:",
    "Tích hợp với Backend Microservices và Headless: Flutter tiêu thụ các RESTful API do hệ thống backend cung cấp và ánh xạ dữ liệu JSON thành các mô hình hiển thị trên thiết bị di động. Việc sử dụng cùng hợp đồng API với ứng dụng web giúp giảm trùng lặp nghiệp vụ và duy trì tính nhất quán dữ liệu. GraphQL là một lựa chọn có thể nghiên cứu khi client cần truy vấn linh hoạt hơn, nhưng không được sử dụng trong phiên bản hiện tại.",
)

new_section = []
new_section.append(make_paragraph_like(section_heading_template, "2.1. Cơ sở lý thuyết và phương pháp nghiên cứu"))
new_section.extend(methods_content)
new_section.append(make_paragraph_like(subsection_template, "2.1.1. Kiến trúc hệ thống phần mềm (Software Architecture)"))
new_section.append(
    make_paragraph_like(
        body_template,
        "Kiến trúc phần mềm mô tả cách tổ chức các thành phần, trách nhiệm và quan hệ giao tiếp trong hệ thống. Đối với NhàHợp, kiến trúc phải hỗ trợ đồng thời nghiệp vụ tìm kiếm phòng, đặt phòng, hợp đồng, quản lý cư dân, sinh hoạt cộng đồng và xử lý gợi ý AI trên cả web lẫn thiết bị di động. Vì vậy, việc lựa chọn kiến trúc được xem xét dựa trên khả năng mở rộng, mức độ độc lập khi triển khai, khả năng bảo trì và tính phù hợp với nguồn lực của đồ án.",
    )
)
new_section.extend(micro_block)
new_section.extend(headless_block)
new_section.extend(combined_block)

new_section.append(make_paragraph_like(subsection_template, "2.1.2. Thuật toán và trí tuệ nhân tạo (Artificial Intelligence & Machine Learning)"))
new_section.extend(ai_overview_block[1:])
new_section.extend(kmeans_block)
new_section.append(
    make_paragraph_like(
        body_template,
        "Việc lựa chọn số cụm k ảnh hưởng trực tiếp đến khả năng diễn giải và chất lượng phân cụm. Elbow Method thực hiện K-means với nhiều giá trị k, tính tổng bình phương khoảng cách trong cụm (Within-Cluster Sum of Squares - WCSS) và chọn điểm mà mức giảm WCSS bắt đầu chậm lại. Silhouette Coefficient đánh giá đồng thời độ gắn kết trong cụm và mức tách biệt giữa các cụm; hệ số càng gần 1 cho thấy cấu trúc cụm càng rõ. Trong bản prototype, k = 4 được sử dụng để tạo bốn nhóm lối sống có thể diễn giải. Khi có tập dữ liệu thực tế lớn hơn, giá trị này cần được kiểm chứng lại bằng đường cong Elbow và Silhouette Coefficient thay vì xem là hằng số cố định.",
    )
)
new_section.append(
    make_paragraph_like(
        body_template,
        "Quy trình K-means gồm bốn bước: khởi tạo k tâm cụm; gán mỗi điểm dữ liệu vào tâm gần nhất theo khoảng cách Euclid; cập nhật tâm bằng giá trị trung bình của các điểm trong cụm; và lặp lại hai bước gán - cập nhật cho đến khi tâm cụm hội tụ hoặc đạt số vòng lặp tối đa. Hàm mục tiêu có dạng J = Σ(k=1..K) Σ(xᵢ∈Cₖ) ||xᵢ - μₖ||², trong đó Cₖ là cụm thứ k và μₖ là tâm cụm. Thuật toán tìm cách tối thiểu hóa độ phân tán nội cụm.",
    )
)
new_section.append(make_paragraph_like(subsubsection_template, "2.1.2.2. Hệ gợi ý (Recommender Systems)"))
new_section.append(
    make_paragraph_like(
        body_template,
        "Hệ gợi ý hỗ trợ lựa chọn đối tượng phù hợp từ một tập lớn ứng viên dựa trên hồ sơ, ràng buộc và dữ liệu tương tác. Trong bài toán co-living, kết quả không chỉ cần liên quan về giá và vị trí mà còn phải tôn trọng các điều kiện sống chung như giới tính, hút thuốc, vật nuôi, sức chứa và thói quen sinh hoạt.",
    )
)
new_section.extend(rule_block)
new_section.extend(collaborative_block)
new_section.append(make_paragraph_like(subsubsection_template, "c) Phương pháp kết hợp (Hybrid Recommendation System)"))
new_section.append(
    make_paragraph_like(
        body_template,
        "Một phương pháp đơn lẻ khó đáp ứng đồng thời tính an toàn nghiệp vụ, khả năng xử lý người dùng mới và mức độ cá nhân hóa. Vì vậy, NhàHợp sử dụng hệ gợi ý lai. Đầu tiên, Rule-based Filtering loại bỏ những phòng không còn khả dụng hoặc vi phạm điều kiện bắt buộc. Tiếp theo, thông tin cụm K-means được dùng như tín hiệu bổ sung để ưu tiên những người có lối sống gần nhau. Sau cùng, Collaborative Filtering và các điểm tương đồng theo hồ sơ được kết hợp để xếp hạng các ứng viên còn lại.",
    )
)
new_section.append(
    make_paragraph_like(
        body_template,
        "Trong phiên bản hiện tại, điểm gợi ý phòng được tổng hợp từ 80% điểm heuristic theo hồ sơ và 20% điểm Collaborative Filtering; điểm thưởng cụm được bổ sung khi người dùng và cư dân trong phòng thuộc nhóm lối sống tương thích. Cách kết hợp này giúp hệ thống vẫn hoạt động khi dữ liệu tương tác còn thưa, đồng thời tăng dần mức độ cá nhân hóa khi số lượng tương tác phát sinh nhiều hơn. Trọng số là tham số của bản prototype và cần được đánh giá lại bằng Precision@K, Recall@K, NDCG và phản hồi người dùng khi triển khai thực tế.",
    )
)

new_section.append(make_paragraph_like(section_heading_template, "2.2. Cơ sở công nghệ và công cụ phát triển (Technologies & Stack)"))
new_section.append(
    make_paragraph_like(
        body_template,
        "Các công nghệ được lựa chọn nhằm hiện thực hóa mô hình lý thuyết, đồng thời phù hợp với kiến trúc Microservices kết hợp Headless. Tiêu chí lựa chọn gồm khả năng phát triển đa nền tảng, hỗ trợ RESTful API, tương thích với PostgreSQL, có hệ sinh thái học máy ổn định và thuận lợi cho việc đóng gói thành container.",
    )
)
new_section.extend(postgres_block)
new_section.append(
    make_paragraph_like(
        body_template,
        "Supabase bổ sung các khả năng như Realtime và Row Level Security (RLS). Realtime có thể phát luồng thay đổi dữ liệu đến client qua WebSocket, phù hợp với trạng thái phòng hoặc thông báo cần cập nhật nhanh. RLS cho phép định nghĩa chính sách truy cập ở mức từng hàng dữ liệu dựa trên người dùng và vai trò. Trong prototype NhàHợp, các client không truy cập trực tiếp cơ sở dữ liệu; dữ liệu chủ yếu đi qua API, Prisma và cơ chế phân quyền của từng service, còn RabbitMQ đảm nhiệm đồng bộ sự kiện nội bộ. Vì vậy, Realtime và RLS được xem là lớp năng lực mở rộng và phòng vệ bổ sung, không nên mô tả là cơ chế đã thay thế hoàn toàn kiểm soát truy cập ở tầng dịch vụ.",
    )
)

new_section.append(make_paragraph_like(subsection_template, "2.2.2. Framework và thư viện Backend/AI"))
new_section.append(make_paragraph_like(subsubsection_template, "2.2.2.1. FastAPI và Python Stack"))
new_section.append(
    make_paragraph_like(
        body_template,
        "AI Service được xây dựng bằng Python và FastAPI. FastAPI hỗ trợ khai báo endpoint dựa trên kiểu dữ liệu, kiểm tra dữ liệu đầu vào bằng Pydantic, xử lý bất đồng bộ và sinh tài liệu OpenAPI tự động. Uvicorn được sử dụng làm máy chủ ASGI. Cấu trúc này phù hợp để đóng gói thuật toán gợi ý thành một microservice độc lập và cung cấp các endpoint như gợi ý phòng, ghép người ở cùng và phân tích mức độ tương thích.",
    )
)
new_section.append(
    make_paragraph_like(
        body_template,
        "Các thư viện chính gồm pandas để đọc, làm sạch và biến đổi dữ liệu dạng bảng; NumPy để thực hiện tính toán vector và ma trận; scikit-learn để cung cấp MinMaxScaler, KMeans và cosine similarity; psycopg và Supabase Python client để truy cập dữ liệu; pika để nhận sự kiện từ RabbitMQ. Việc tách AI Service khỏi backend nghiệp vụ cho phép thay đổi mô hình hoặc mở rộng tài nguyên xử lý mà không phải triển khai lại toàn bộ hệ thống.",
    )
)
new_section.append(make_paragraph_like(subsubsection_template, "2.2.2.2. Node.js, Express và Prisma"))
new_section.append(
    make_paragraph_like(
        body_template,
        "Các microservice nghiệp vụ của NhàHợp sử dụng Node.js và Express. Node.js phù hợp với các tác vụ I/O như xử lý HTTP, truy cập cơ sở dữ liệu và trao đổi thông điệp; Express cung cấp mô hình middleware và routing gọn nhẹ để xây dựng RESTful API. Các service hiện có gồm Identity, Property, Rental, Community và Preference, được đặt sau API Gateway.",
    )
)
new_section.append(
    make_paragraph_like(
        body_template,
        "Prisma ORM được sử dụng để định nghĩa schema, sinh client truy vấn và quản lý migration cho từng service schema trên PostgreSQL. RabbitMQ và thư viện amqplib hỗ trợ giao tiếp bất đồng bộ; Outbox Pattern được áp dụng ở các nghiệp vụ cần phát sự kiện đáng tin cậy. Việc sử dụng Node.js/Express cho nghiệp vụ và FastAPI/Python cho AI thể hiện đặc trưng lựa chọn công nghệ theo nhu cầu của từng microservice.",
    )
)

new_section.append(make_paragraph_like(subsection_template, "2.2.3. Công nghệ Frontend và đa nền tảng"))
new_section.extend(next_block)
new_section.extend(flutter_block)
new_section.extend(docker_block)

# Xóa phần 2.1 cũ rồi chèn cấu trúc mới ngay trước 2.2 cũ.
for element in original_elements[p21_index:old22_index]:
    body.remove(element)
for offset, element in enumerate(new_section):
    body.insert(p21_index + offset, element)

# Đánh lại số các mục sau phần công nghệ.
chapter2_elements = list(body)
chapter2_start = find_last_index(chapter2_elements, "CHƯƠNG 2.")
chapter3_start = find_index(chapter2_elements, "CHƯƠNG 3.", chapter2_start)
for element in chapter2_elements[chapter2_start:chapter3_start]:
    text = paragraph_text(element)
    if re.match(r"^2\.4(?:\.|\s)", text):
        replace_paragraph_text(element, re.sub(r"^2\.4", "2.5", text, count=1))
    elif re.match(r"^2\.3(?:\.|\s)", text):
        replace_paragraph_text(element, re.sub(r"^2\.3", "2.4", text, count=1))
    elif re.match(r"^2\.2(?:\.|\s)", text):
        # Chỉ đổi phần "Mô hình lý thuyết" cũ và các mục con cũ; phần 2.2 mới
        # đứng trước nó nên được nhận diện bằng nội dung.
        if "Cơ sở công nghệ và công cụ phát triển" not in text and not text.startswith(
            ("2.2.1. PostgreSQL", "2.2.2.", "2.2.3.", "2.2.4.")
        ):
            replace_paragraph_text(element, re.sub(r"^2\.2", "2.3", text, count=1))

# Chuẩn hóa cấp tiêu đề cho những đoạn vốn bị định dạng Normal trong bản nguồn.
chapter2_elements = list(body)
chapter2_start = find_last_index(chapter2_elements, "CHƯƠNG 2.")
chapter3_start = find_index(chapter2_elements, "CHƯƠNG 3.", chapter2_start)
for element in chapter2_elements[chapter2_start:chapter3_start]:
    text = paragraph_text(element)
    if text.startswith("2.3. Mô hình lý thuyết"):
        copy_paragraph_properties(element, section_heading_template)
    elif text.startswith("2.4.4.3."):
        copy_paragraph_properties(element, subsubsection_template)

# Sửa trực tiếp các tiêu đề cấp sau do phép đổi trên không bao quát mục 2.3 cũ
# trong trường hợp chúng xuất hiện sau khi mục 2.2 cũ đã được đổi.
chapter2_elements = list(body)
chapter2_start = find_last_index(chapter2_elements, "CHƯƠNG 2.")
chapter3_start = find_index(chapter2_elements, "CHƯƠNG 3.", chapter2_start)
seen_theoretical_model = False
for element in chapter2_elements[chapter2_start:chapter3_start]:
    text = paragraph_text(element)
    if text.startswith("2.3. Mô hình lý thuyết"):
        seen_theoretical_model = True
        continue
    if seen_theoretical_model and text.startswith("2.3.") and not text.startswith("2.3. Mô hình"):
        replace_paragraph_text(element, re.sub(r"^2\.3", "2.4", text, count=1))

# Chuẩn hóa số thứ tự hình và bảng trong Chương 2 theo thứ tự xuất hiện.
chapter2_elements = list(body)
chapter2_start = find_last_index(chapter2_elements, "CHƯƠNG 2.")
chapter3_start = find_index(chapter2_elements, "CHƯƠNG 3.", chapter2_start)
figure_number = 0
table_number = 0
for element in chapter2_elements[chapter2_start:chapter3_start]:
    text = paragraph_text(element)
    figure_match = re.match(r"^Hình\s+(?:2\.\d+|\d+)(?:[.:])?\s*(.*)$", text)
    if figure_match:
        figure_number += 1
        description = figure_match.group(1).strip()
        replace_paragraph_text(
            element,
            f"Hình 2.{figure_number}. {description}" if description else f"Hình 2.{figure_number}",
        )
        continue
    table_match = re.match(r"^Bảng\s+(?:2\.\d+|\d+)(?:[.:])?\s*(.*)$", text)
    if table_match:
        table_number += 1
        description = table_match.group(1).strip()
        replace_paragraph_text(
            element,
            f"Bảng 2.{table_number}. {description}" if description else f"Bảng 2.{table_number}",
        )

# Yêu cầu Word/LibreOffice cập nhật các trường như mục lục khi mở tài liệu.
settings = document.settings._element
update_fields = settings.find(qn("w:updateFields"))
if update_fields is None:
    update_fields = OxmlElement("w:updateFields")
    settings.append(update_fields)
update_fields.set(qn("w:val"), "true")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
document.save(OUTPUT)
print(OUTPUT)
