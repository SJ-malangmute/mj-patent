import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import { collection, setDoc, doc, deleteDoc, getDocs, orderBy, query, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";

function App() {
  const [text, setText] = useState(""); // 영어 텍스트 입력받기
  const [wordList, setWordList] = useState([]); // 영어-한국어 단어 쌍 리스트
  const [currentWord, setCurrentWord] = useState(""); // 단일 단어 입력
  const [currentTranslation, setCurrentTranslation] = useState(""); // 번역어 입력
  const [currentNotice, setCurrentNotice] = useState("");
  const [fontSize, setFontSize] = useState(16); // 기본 폰트 사이즈 16px
  const collectionName = "wordlist";

  const englishWordRef = useRef(null);
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
        saveWordToFirestore([{ word: currentWord, translation: currentTranslation }])
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
    deleteAllDocuments(collectionName)
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

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addWordPair();
      // addWordPair 실행 후 "Enter English Word" 필드로 포커스 이동
      englishWordRef.current.focus();
    }
  };

  // XLSX 파일을 읽어와 wordList에 추가하는 함수
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer(); // FileReader 대신 더 현대적인 방식 사용
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet);

      // 데이터 처리 로직 분리 및 최적화
      const newWordList = json.reduce((acc, row) => {
        const word = row.word || row.English || row["영어"];
        const translation = row.translation || row.Korean || row["한국어"];
        
        if (word && !wordList.some(pair => pair.word.toLowerCase() === word.toLowerCase())) {
          acc.push({ word, translation });
        }
        return acc;
      }, []);

      if (newWordList.length > 0) {
        setWordList(prevList => [...prevList, ...newWordList]);
        await saveWordToFirestore(newWordList);
      }
    } catch (error) {
      console.error('파일 처리 중 오류 발생:', error);
      alert('파일 처리 중 오류가 발생했습니다.');
    }
  };

  // Firestore에서 단어 리스트 가져오는 함수
  const fetchWordListFromFirestore = async () => {
    try {
      const q = query(
        collection(db, collectionName),
        orderBy("Timestamp", "desc") // Timestamp 필드에 대해 내림차순 정렬
      );
      const querySnapshot = await getDocs(q);

      const wordsFromFirestore = querySnapshot.docs.map((doc) => ({
        word: doc.id, // 문서 ID를 word로 사용
        translation: doc.data().translation,
      }));
      
      setWordList(wordsFromFirestore.reverse());
      console.log("Fetched word list from Firestore:", wordsFromFirestore);
    } catch (error) {
      console.error("Error fetching word list from Firestore:", error);
    }
  };

  const fetchNoticeFromFirestore = async () => {
    try {
      const noticeDocRef = collection(db, "notice");
      const noticeDoc = await getDocs(noticeDocRef);

      const noticeFromFirestore = noticeDoc.docs.map((doc) => ({
        notice: doc.data().value
      }));
      setCurrentNotice(noticeFromFirestore[0].notice);
      console.log(noticeFromFirestore[0].notice);
      // if (noticeDoc.docs.exists()){
      //   const val = noticeDoc.docs.data().value
      //   setCurrentNotice(val);
      //   console.log("Fetched value:", val);
      // }
      // else{
      //   console.log("No such document!");
      // }
    } catch (error) {
      console.error("Error fetching value from Firestore:", error);
    }
  }

  // 페이지 시작 시 단어 리스트 가져오기
  useEffect(() => {
    fetchWordListFromFirestore();
    fetchNoticeFromFirestore();
  }, []);

  const deleteAllDocuments = async (collectionName) => {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
  
      const deletePromises = querySnapshot.docs.map((document) =>
        deleteDoc(doc(db, collectionName, document.id))
      );
  
      await Promise.all(deletePromises);
      console.log(`All documents in the "${collectionName}" collection have been deleted.`);
    } catch (error) {
      console.error("Error deleting all documents: ", error);
    }
  };

  const deleteWordPair = async (index) => {
    const wordToDelete = wordList[index].word;

    setWordList(wordList.filter((_, i) => i !== index));

    try {
      // Firestore에서 동일한 문서 ID 삭제
      const wordDocRef = doc(collection(db, collectionName), wordToDelete);
      await deleteDoc(wordDocRef);
      console.log(`Deleted ${wordToDelete} from Firestore`);
    } catch (error) {
      console.error("Error deleting from Firestore: ", error);
    }
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
    if (wordList.length === 0){
      const paragraphs = text.split("\n").map((paragraph, paragraphIndex)=>{
        return (
          <p key={paragraphIndex} style={{ marginBottom: "1em", whiteSpace: "pre-wrap", fontSize: `${fontSize}px`}}>
            {paragraph}
          </p>
        );
      });
      return <div>{paragraphs}</div>;
    };
    // 단어 리스트를 단어 길이 순서대로 정렬 (긴 단어가 우선 매칭)
    const sortedWordList = [...wordList].sort((a, b) => b.word.length - a.word.length);

    // 오른쪽 리스트의 모든 단어로 정규식 패턴 생성
    const regex = new RegExp(`(${wordList.map((pair) => pair.word).join("|")})`, "gi");

    const paragraphs = text.split("\n").map((paragraph, paragraphIndex) =>{
      const parts = paragraph.split(regex);

      const words = parts.map((part, index) => {
        // 하이라이트된 단어 여부를 확인
        const pair = sortedWordList.find((pair) => part.toLowerCase().includes(pair.word.toLowerCase()));
        // console.log(pair)
        const isHighlighted = !!pair;

        return (
          <span
            key={index}
            onMouseOver={() => pair && setCurrentTranslation(pair.translation)} // 호버 시 번역어 설정
            onMouseOut={() => setCurrentTranslation("")} // 호버 해제 시 번역어 초기화
            style={{
              backgroundColor: isHighlighted ? "rgb(255, 204, 204)" : "transparent",
              position: "relative",
              margin: "0 2px",
              fontSize: `${fontSize}px`, // 폰트 사이즈 적용
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
      return (
        <p key={paragraphIndex} style={{ marginBottom: "1em", whiteSpace: "pre-wrap", fontSize: `${fontSize}px`}}>
          {words}
        </p>
      );
    });
    return <div>{paragraphs}</div>;
  };

  const saveWordToFirestore = async (wordPairList) => {
    try {
      const wordlistRef = collection(db, collectionName);
  
      // wordPairList의 각 wordPair를 Firestore에 저장
      await Promise.all(
        wordPairList.map(async (wordPair) => {
          const wordDocRef = doc(wordlistRef, wordPair.word);
          await setDoc(wordDocRef, {
            Timestamp: serverTimestamp(),
            word: wordPair.word,
            translation: wordPair.translation,
          });
        })
      );
      console.log("All word pairs saved to Firestore!");
    } catch (error) {
      console.error("Error saving word pairs to Firestore: ", error);
    }
  }

  const saveWordsToFirestore = async () => {
    try {
      const wordListRef = collection(db, collectionName);

      // 모든 단어 리스트를 Firestore에 저장
      await Promise.all(
        wordList.map(async (wordPair) => {
          const wordDocRef = doc(wordListRef, wordPair.word);
          await setDoc(wordDocRef, {
            Timestamp: serverTimestamp(),
            word: wordPair.word,
            translation: wordPair.translation,
          });
        })
      );
      console.log("Data saved to Firestore!");
    } catch (error) {
      console.error("Error saving to Firestore: ", error);
    }
  };

  // useEffect(() => {
  //   const interval = setInterval(saveWordToFirestore, 6000); // 10초마다 저장
  //   return () => clearInterval(interval);
  // }, [wordList]);

  // useEffect(() => {
  //   if (wordList.length > 0) {
  //     saveWordsToFirestore();
  //   }
  // }, [wordList]);

  return (
    <div className="app-container">
      {/* 네비게이션 바 추가 */}
      {/* <nav className="navbar">
        <div className="nav-logo">
          <button className="menu-button">☰</button>
        </div>
        <div className="nav-links">
          <a href="#" className="active">HOME</a>
          <a href="#">NEWS</a>
          <a href="#">WALLET</a>
        </div>
      </nav> */}

      {/* 헤더 섹션 수정 */}
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">{currentNotice}</h1>
          {/* <p className="hero-subtitle">Digital Assets Fan Community</p>
          <p className="hero-description">
            High-quality community platform based on the certificate economy
          </p>
          <button className="details-button">DETAILS</button> */}
        </div>
      </div>

      {/* 기존 메인 컨텐츠 스타일 수정 */}
      <div className="main-content">
        <div className="text-input-section">
          <h2 className="section-title">English Text Input</h2>
          <div className="font-size-controls" style={{ 
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <button 
              className="action-button"
              onClick={() => setFontSize(prev => Math.max(8, prev - 2))}
            >
              글자 작게
            </button>
            <span>{fontSize}px</span>
            <button 
              className="action-button"
              onClick={() => setFontSize(prev => Math.min(64, prev + 2))}
            >
              글자 크게
            </button>
          </div>
          <textarea
            className="text-input"
            rows="10"
            value={text}
            onChange={handleTextChange}
            placeholder="Enter English text here..."
          ></textarea>
          <div className="text-display">
            {renderTextWithHover(text)}
          </div>
        </div>

        <div className="word-list-section">
          <h2 className="section-title">Word Translation List</h2>
          <div className="input-group">
            <input
              ref={englishWordRef}
              type="text"
              className="word-input"
              placeholder="Enter English word"
              value={currentWord}
              onChange={(e) => setCurrentWord(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <input
              type="text"
              className="word-input"
              placeholder="Enter Korean translation"
              value={currentTranslation}
              onChange={(e) => setCurrentTranslation(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button className="action-button" onClick={addWordPair}>Add</button>
            <button className="action-button" onClick={clearWordList}>Clear List</button>
          </div>

          <div className="file-controls">
            <button className="action-button" onClick={saveToXLSX}>
              Export to Excel
            </button>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileUpload}
              className="file-input"
            />
          </div>

          <ul className="word-list">
            {wordList.map((pair, index) => (
              <li key={index} className="word-item">
                <span>{pair.word} - {pair.translation}</span>
                <button 
                  className="delete-button"
                  onClick={() => deleteWordPair(index)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
