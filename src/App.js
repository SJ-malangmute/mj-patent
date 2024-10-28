import React, { useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";

function App() {
  const [text, setText] = useState(""); // 영어 텍스트 입력받기
  const [wordList, setWordList] = useState([]); // 영어-한국어 단어 쌍 리스트
  const [currentWord, setCurrentWord] = useState(""); // 단일 단어 입력
  const [currentTranslation, setCurrentTranslation] = useState(""); // 번역어 입력

  // 텍스트 변경 시 호출
  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  // 단어-번역어 쌍 추가 시 호출
  const addWordPair = () => {
    if (currentWord && currentTranslation) {
      // 중복 검사
      const isDuplicate = wordList.some((pair) => pair.word.toLowerCase() === currentWord.toLowerCase());
      if (!isDuplicate) {
        setWordList([...wordList, { word: currentWord, translation: currentTranslation }]);
      } else {
        alert("This English word is already in the list.");
      }
      setCurrentWord("");
      setCurrentTranslation("");
    }
  };

  // 리스트 초기화 함수
  const clearWordList = () => {
    setWordList([]); // 단어 리스트 초기화
  };

  const saveToXLSX = () => {
    // 워크북 및 시트 생성
    const worksheet = XLSX.utils.json_to_sheet(wordList);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Word List");
  
    // 워크북을 바이너리 데이터로 변환
    const workbookBinary = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  
    // Blob 생성 후 다운로드
    const blob = new Blob([workbookBinary], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "word_list.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // XLSX 파일을 읽어와 wordList에 추가하는 함수
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      // 파일의 데이터를 중복 검사하여 wordList에 추가
      const newWordList = json
        .map((row) => ({
          word: row.word || row.English || row["영어"],
          translation: row.translation || row.Korean || row["한국어"],
        }))
        .filter(
          (newPair) =>
            newPair.word && // 영어 단어가 존재하는지 확인
            !wordList.some((pair) => pair.word.toLowerCase() === newPair.word.toLowerCase()) // 중복 방지
        );

      setWordList((prevList) => [...prevList, ...newWordList]);
    };
    reader.readAsArrayBuffer(file);
  };
  
  const deleteWordPair = (index) => {
    setWordList(wordList.filter((_, i) => i !== index));
  };

  // 텍스트를 단어별로 나누어 hover 이벤트 처리
  // const renderTextWithHover = (text) => {
  //   return text.split(" ").map((word, index) => (
  //     <span
  //       key={index}
  //       className="hover-word"
  //       onMouseOver={() => setCurrentTranslation(getTranslation(word))}
  //       onMouseOut={() => setCurrentTranslation("")}
  //       style={{ margin: "0 5px" }}
  //     >
  //       {word}
  //     </span>
  //   ));
  // };
  const renderTextWithHover = (text) => {
    if (wordList.length === 0) return text;

    // 오른쪽 리스트의 모든 단어로 정규식 패턴 생성
    const regex = new RegExp(`(${wordList.map((pair) => pair.word).join("|")})`, "gi");

    // 텍스트를 정규식을 사용해 분할
    const parts = text.split(regex);

    return parts.map((part, index) => {
      // 하이라이트된 단어 여부를 확인
      const pair = wordList.find((pair) => part.toLowerCase().includes(pair.word.toLowerCase()));
      console.log(pair)
      const isHighlighted = !!pair;

      return (
        <span
          key={index}
          onMouseOver={() => pair && setCurrentTranslation(pair.translation)} // 호버 시 번역어 설정
          onMouseOut={() => setCurrentTranslation("")} // 호버 해제 시 번역어 초기화
          style={{
            backgroundColor: isHighlighted ? "yellow" : "transparent",
            position: "relative",
            margin: "0 2px",
          }}
        >
          {part}
          {/* 번역 텍스트를 hover 시에만 표시 */}
          {isHighlighted && currentTranslation === pair.translation && (
            <span
              style={{
                position: "absolute",
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                padding: "5px",
                backgroundColor: "#333",
                color: "#fff",
                borderRadius: "5px",
                whiteSpace: "nowrap",
                zIndex: 1,
                visibility: currentTranslation === pair.translation ? "visible" : "hidden",
              }}
            >
              {pair.translation}
            </span>
          )}
        </span>
      );
    });
  };

  return (
    <div className="App" style={{ alignItems: "flex-start", justifyContent: "space-between", display: "flex", padding: "20px", height:"auto" }}>
      {/* 왼쪽 - 영어 텍스트 입력 */}
      <div style={{ flex: 3, width: "100%", 
            height: "100vh", overflowY: "scroll"}}>
        <h2>English Text Input</h2>
        <textarea
          rows="10"
          style={{ width: "90%"}}
          value={text}
          wrap="hard"
          onChange={handleTextChange}
          placeholder="Enter English text here..."
        ></textarea>
        <div style={{
            marginTop: "20px",
            padding: "10px",
            background: "#f9f9f9",
            borderRadius: "5px",
            overflowY: "scroll",
            height: "500px",
            width: "90%", // 고정 너비
            wordWrap: "break-word", // 긴 단어 줄바꿈
            whiteSpace: "pre-wrap", // 줄바꿈 적용
          }}>
          {renderTextWithHover(text)}
        </div>
      </div>

      {/* 오른쪽 - 단어와 번역어 리스트 */}
      <div style={{ flex: 2 }}>
        <h2>Word Translation List</h2>
        <input
          type="text"
          placeholder="Enter English word"
          value={currentWord}
          onChange={(e) => setCurrentWord(e.target.value)}
          style={{ marginRight: "10px", marginBottom: "10px" }}
        />
        <input
          type="text"
          placeholder="Enter Korean translation"
          value={currentTranslation}
          onChange={(e) => setCurrentTranslation(e.target.value)}
          style={{ marginRight: "10px", marginBottom: "10px" }}
        />
        <button onClick={addWordPair}>Add</button>

        {/* 리스트 초기화 버튼 */}
        <button onClick={clearWordList} style={{ display: "block", marginTop: "10px" }}>
          Clear List
        </button>

        {/* 엑셀 파일 저장 버튼 */}
        <button onClick={saveToXLSX} style={{ marginTop: "10px" }}>
          Save as XLSX
        </button>

        {/* 엑셀 파일 업로드 버튼 */}
        <input
          type="file"
          accept=".xlsx"
          onChange={handleFileUpload}
          style={{ display: "block", marginTop: "10px" }}
        />

        <ul style={{ listStyleType: "none", padding: "10px", background: "#f1f1f1", borderRadius: "5px", marginTop: "20px" }}>
          {wordList.map((pair, index) => (
            <li key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                {pair.word} - {pair.translation}
              </span>
              <button onClick={() => deleteWordPair(index)} style={{ marginLeft: "10px" }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
